import { checkLockStatus } from "../core"
import { AstroCloudflareConfigSchema } from "../schemas/astro-cloudflare"
import {
  buildLockPageUrl,
  createRedirect,
  isHTMLRequest,
  printMessage,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
} from "../utils"

/**
 * Cloudflare runtime context provided by Astro on Cloudflare Workers.
 * This is the shape of `context.locals.runtime` when using @astrojs/cloudflare adapter.
 */
export interface AstroCloudflareRuntime {
  env: CloudflareEnv
  ctx: ExecutionContext
}

/**
 * Configuration for the Appwarden middleware.
 */
export interface AstroAppwardenConfig {
  /** The slug/path of the lock page to redirect to when the site is locked */
  lockPageSlug: string
  /** The Appwarden API token for authentication */
  appwardenApiToken: string
  /** Optional custom API hostname (defaults to https://api.appwarden.io) */
  appwardenApiHostname?: string
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Configuration function that receives the Cloudflare runtime and returns the config.
 * This allows dynamic configuration based on environment variables.
 */
export type AstroConfigFn = (
  runtime: AstroCloudflareRuntime,
) => AstroAppwardenConfig

/**
 * Astro middleware context type.
 * This matches Astro's APIContext shape for middleware.
 */
export interface AstroMiddlewareContext {
  /** The incoming request */
  request: Request
  /** Object for storing request-specific data */
  locals: {
    runtime?: AstroCloudflareRuntime
    [key: string]: unknown
  }
  /** Helper to create redirect responses */
  redirect: (path: string, status?: number) => Response
}

/**
 * Astro middleware function signature.
 * This matches the onRequest export type in Astro's middleware system.
 */
export type AstroMiddlewareFunction = (
  context: AstroMiddlewareContext,
  next: () => Promise<Response>,
) => Promise<Response>

/**
 * Creates an Appwarden middleware function for Astro.
 *
 * This middleware checks if the site is locked and redirects to the lock page if so.
 * It should be used with Astro's `sequence()` function or exported directly as `onRequest`.
 *
 * @example
 * ```typescript
 * // src/middleware.ts
 * import { sequence } from "astro:middleware"
 * import { createAppwardenMiddleware } from "@appwarden/middleware/astro"
 *
 * const appwarden = createAppwardenMiddleware(({ env }) => ({
 *   lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *   appwardenApiToken: env.APPWARDEN_API_TOKEN,
 * }))
 *
 * export const onRequest = sequence(appwarden)
 * ```
 *
 * @param configFn - A function that receives the Cloudflare runtime and returns the config
 * @returns An Astro middleware function
 */
export function createAppwardenMiddleware(
  configFn: AstroConfigFn,
): AstroMiddlewareFunction {
  return async (context, next) => {
    const { request, locals } = context

    try {
      // Get Cloudflare runtime from Astro locals
      const runtime = locals.runtime
      if (!runtime) {
        console.error(
          printMessage(
            "Cloudflare runtime not found. Ensure @astrojs/cloudflare adapter is configured.",
          ),
        )
        return next()
      }

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTMLRequest(request)) {
        return next()
      }

      // Get config from the config function
      const config = configFn(runtime)
      // Validate config against schema
      const hasError = validateConfig(config, AstroCloudflareConfigSchema)
      if (hasError) {
        return next()
      }

      // Check lock status
      const result = await checkLockStatus({
        request,
        appwardenApiToken: config.appwardenApiToken,
        appwardenApiHostname: config.appwardenApiHostname,
        debug: config.debug,
        lockPageSlug: config.lockPageSlug,
        waitUntil: (fn) => runtime.ctx.waitUntil(fn),
      })

      // If locked, redirect to lock page
      if (result.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)

        // Use Astro's redirect helper if available, otherwise create our own redirect
        if (context.redirect) {
          return context.redirect(
            lockPageUrl.toString(),
            TEMPORARY_REDIRECT_STATUS,
          )
        }
        return createRedirect(lockPageUrl)
      }

      // Continue to next middleware/route
      return next()
    } catch (error) {
      // Re-throw redirects and responses
      if (error instanceof Response) {
        throw error
      }

      // Log other errors but don't block the request
      console.error(
        printMessage(
          `Error in Appwarden middleware: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      return next()
    }
  }
}

import type { Runtime } from "@astrojs/cloudflare"
import type { APIContext, MiddlewareHandler } from "astro"
import { checkLockStatus } from "../core"
import { useContentSecurityPolicy } from "../middlewares"
import type { UseCSPInput } from "../schemas"
import { AstroCloudflareConfigSchema } from "../schemas/astro-cloudflare"
import {
  buildLockPageUrl,
  createRedirect,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
} from "../utils"

/**
 * Cloudflare runtime context provided by Astro on Cloudflare Workers.
 * This is extracted from the locals object when using @astrojs/cloudflare adapter.
 *
 * Note: Uses generic CloudflareEnv which should be defined in the user's project.
 */
export type AstroCloudflareRuntime = Runtime<CloudflareEnv>["runtime"]

/**
 * Locals interface with Cloudflare runtime.
 * This is the expected shape of context.locals when using @astrojs/cloudflare.
 */
interface LocalsWithRuntime {
  runtime?: AstroCloudflareRuntime
  [key: string]: unknown
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
  /** Optional Content Security Policy configuration */
  contentSecurityPolicy?: UseCSPInput
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
 * Re-exported from Astro's official APIContext type for type compatibility.
 *
 * @deprecated Use `APIContext` from 'astro' directly. This alias is kept for backward compatibility.
 */
export type AstroMiddlewareContext = APIContext

/**
 * Astro middleware function signature.
 * This is an alias for Astro's official MiddlewareHandler type for type compatibility.
 *
 * @deprecated Use `MiddlewareHandler` from 'astro' directly. This alias is kept for backward compatibility.
 */
export type AstroMiddlewareFunction = MiddlewareHandler

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
): MiddlewareHandler {
  return async (context, next) => {
    const { request } = context
    // Cast locals to include runtime property added by @astrojs/cloudflare
    const locals = context.locals as LocalsWithRuntime

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

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(config.lockPageSlug, request.url)) {
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

      // Continue to next middleware/route and get the response
      const response = await next()

      // Apply CSP if configured (runs after origin)
      if (config.contentSecurityPolicy) {
        // Create a mini context for CSP middleware
        const cspContext = {
          request,
          response,
          hostname: new URL(request.url).hostname,
          waitUntil: (fn: any) => runtime.ctx.waitUntil(fn),
        }

        await useContentSecurityPolicy(config.contentSecurityPolicy)(
          cspContext,
          async () => {}, // no-op next
        )

        return cspContext.response
      }

      return response
    } catch (error) {
      // Re-throw redirects and responses
      if (error instanceof Response) {
        throw error
      }

      // Log other errors but don't block the request
      console.error(
        printMessage(
          `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      return next()
    }
  }
}

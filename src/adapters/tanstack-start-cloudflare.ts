import { checkLockStatus } from "../core"
import { useContentSecurityPolicy } from "../middlewares"
import type { UseCSPInput } from "../schemas"
import { TanStackStartCloudflareConfigSchema } from "../schemas/tanstack-start-cloudflare"
import {
  buildLockPageUrl,
  createRedirect,
  debug,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
  validateConfig,
} from "../utils"

/**
 * Cloudflare context provided by TanStack Start on Cloudflare Workers.
 * This is the shape of the cloudflare context available in middleware.
 */
export interface TanStackStartCloudflareContext {
  env: CloudflareEnv
  ctx: ExecutionContext
}

/**
 * Configuration for the Appwarden middleware.
 */
export interface TanStackStartAppwardenConfig {
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
 * Configuration function that receives the Cloudflare context and returns the config.
 * This allows dynamic configuration based on environment variables.
 */
export type TanStackStartConfigFn = (
  cloudflare: TanStackStartCloudflareContext,
) => TanStackStartAppwardenConfig

/**
 * TanStack Start middleware server callback arguments.
 * This matches the shape of arguments passed to createMiddleware().server().
 */
export interface TanStackStartMiddlewareArgs {
  request: Request
  next: () => Promise<unknown>
  context: {
    cloudflare?: TanStackStartCloudflareContext
    [key: string]: unknown
  }
}

/**
 * TanStack Start middleware function signature.
 * This matches the return type of createMiddleware().server().
 */
export type TanStackStartMiddlewareFunction = (
  args: TanStackStartMiddlewareArgs,
) => Promise<unknown>

/**
 * Creates an Appwarden middleware function for TanStack Start.
 *
 * This middleware checks if the site is locked and throws a redirect to the lock page if so.
 * It should be added to the `requestMiddleware` array in your `src/start.ts` file.
 *
 * @example
 * ```typescript
 * // src/start.ts
 * import { createStart } from "@tanstack/react-start"
 * import { createAppwardenMiddleware } from "@appwarden/middleware/tanstack-start"
 *
 * const appwardenMiddleware = createAppwardenMiddleware(({ env }) => ({
 *   lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *   appwardenApiToken: env.APPWARDEN_API_TOKEN,
 * }))
 *
 * export const startInstance = createStart(() => ({
 *   requestMiddleware: [appwardenMiddleware],
 * }))
 * ```
 *
 * @param configFn - A function that receives the Cloudflare context and returns the config
 * @returns A TanStack Start middleware function
 */
export function createAppwardenMiddleware(
  configFn: TanStackStartConfigFn,
): TanStackStartMiddlewareFunction {
  return async (args) => {
    const startTime = Date.now()
    const { request, next, context } = args

    try {
      // Get Cloudflare context from TanStack Start context
      const cloudflare = context.cloudflare
      if (!cloudflare) {
        console.error(
          printMessage(
            "Cloudflare context not found. Ensure running on Cloudflare Workers with proper context setup.",
          ),
        )
        return next()
      }

      // Get config from the config function
      const config = configFn(cloudflare)
      const debugFn = debug(config.debug ?? false)
      const requestUrl = new URL(request.url)
      const isHTML = isHTMLRequest(request)

      debugFn(
        `Appwarden middleware invoked for ${requestUrl.pathname}`,
        `HTML request: ${isHTML}`,
      )

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTML) {
        return next()
      }

      // Validate config against schema
      const hasError = validateConfig(
        config,
        TanStackStartCloudflareConfigSchema,
      )
      if (hasError) {
        return next()
      }

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(config.lockPageSlug, request.url)) {
        debugFn("Already on lock page - skipping")
        return next()
      }

      // Check lock status
      const result = await checkLockStatus({
        request,
        appwardenApiToken: config.appwardenApiToken,
        appwardenApiHostname: config.appwardenApiHostname,
        debug: config.debug,
        lockPageSlug: config.lockPageSlug,
        waitUntil: (fn) => cloudflare.ctx.waitUntil(fn),
      })

      // If locked, throw redirect to lock page
      if (result.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
        debugFn(`Site is locked - redirecting to ${lockPageUrl.pathname}`)
        throw createRedirect(lockPageUrl)
      }

      debugFn("Site is unlocked - continuing to origin")

      // Continue to next middleware/handler and get the response
      const response = await next()

      // Apply CSP if configured (runs after origin)
      if (config.contentSecurityPolicy && response instanceof Response) {
        debugFn("Applying CSP middleware")
        // Create a mini context for CSP middleware
        const cspContext = {
          request,
          response,
          hostname: requestUrl.hostname,
          waitUntil: (fn: any) => cloudflare.ctx.waitUntil(fn),
          debug: debugFn,
        }

        await useContentSecurityPolicy(config.contentSecurityPolicy)(
          cspContext,
          async () => {}, // no-op next
        )

        const elapsed = Date.now() - startTime
        debugFn(`Appwarden middleware completed in ${elapsed}ms`)
        return cspContext.response
      }

      const elapsed = Date.now() - startTime
      debugFn(`Appwarden middleware completed in ${elapsed}ms`)
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

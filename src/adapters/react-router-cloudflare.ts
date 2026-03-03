import { checkLockStatus } from "../core"
import { useContentSecurityPolicy } from "../middlewares"
import {
  type ReactRouterAppwardenConfigInput,
  ReactRouterCloudflareConfigSchema,
} from "../schemas/react-router-cloudflare"
import {
  buildLockPageUrl,
  createRedirect,
  debug,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
} from "../utils"
import { getNowMs } from "../utils/get-now"
import { isResponseLike } from "../utils/is-response-like"

/**
 * Minimal runtime context required by the React Router adapter.
 * Contains only the essential properties needed by the middleware.
 */
export interface ReactRouterRuntimeContext {
  /** Cloudflare environment bindings */
  env: CloudflareEnv
  /** Function to extend the lifetime of the request for background tasks */
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Configuration function that receives the runtime context and returns the config.
 * This allows dynamic configuration based on environment variables.
 * The config can use the relaxed input types (string | boolean for debug,
 * string | object for CSP directives) which will be transformed by Zod.
 */
export type ReactRouterConfigFn = (
  runtime: ReactRouterRuntimeContext,
) => ReactRouterAppwardenConfigInput

/**
 * React Router middleware function signature.
 * This matches the unstable_middleware export type in React Router v7.
 *
 * The context should contain the runtime context with env and waitUntil.
 */
export interface ReactRouterMiddlewareArgs {
  request: Request
  params: Record<string, string | undefined>
  context: ReactRouterRuntimeContext
}

export type ReactRouterMiddlewareFunction = (
  args: ReactRouterMiddlewareArgs,
  next: () => Promise<unknown>,
) => Promise<unknown>

/**
 * Creates an Appwarden middleware function for React Router.
 *
 * This middleware checks if the site is locked and redirects to the lock page if so.
 * It should be exported from your root route (root.tsx) to protect all routes.
 *
 * @example
 * ```typescript
 * // app/root.tsx
 * import { createAppwardenMiddleware } from "@appwarden/middleware/react-router"
 *
 * export const unstable_middleware = [
 *   createAppwardenMiddleware(({ env }) => ({
 *     lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *     appwardenApiToken: env.APPWARDEN_API_TOKEN,
 *   })),
 * ]
 * ```
 *
 * @param configFn - A function that receives the runtime context and returns the config
 * @returns A React Router middleware function
 */
export function createAppwardenMiddleware(
  configFn: ReactRouterConfigFn,
): ReactRouterMiddlewareFunction {
  return async (args, next) => {
    const startTime = getNowMs()
    const { request, context } = args

    try {
      // Check if runtime context has required properties
      if (!context?.env || !context?.waitUntil) {
        console.error(
          printMessage(
            "Runtime context missing required properties (env, waitUntil). Make sure you're passing the correct context to the middleware.",
          ),
        )
        return next()
      }

      // Get config from the config function (using input type - will be validated)
      const configInput = configFn(context)

      // Validate and transform config against schema
      const validationResult =
        ReactRouterCloudflareConfigSchema.safeParse(configInput)
      if (!validationResult.success) {
        console.error(
          printMessage(
            `Config validation failed: ${validationResult.error.message}`,
          ),
        )
        return next()
      }

      const config = validationResult.data
      const debugFn = debug(config.debug)
      const requestUrl = new URL(request.url)
      const isHTML = isHTMLRequest(request)

      debugFn(
        `Appwarden middleware invoked for ${requestUrl.pathname}`,
        `isHTML: ${isHTML}`,
      )

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTML) {
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
        waitUntil: context.waitUntil,
      })

      // If locked, redirect to lock page
      if (result.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
        debugFn(`Website is locked - redirecting to ${lockPageUrl.pathname}`)
        throw createRedirect(lockPageUrl)
      }

      debugFn("Website is unlocked")

      // Continue to next middleware/loader and get the response
      const response = await next()

      // Apply CSP if configured (runs after origin)
      if (config.contentSecurityPolicy && isResponseLike(response)) {
        // Create a mini context for CSP middleware
        const cspContext = {
          request,
          response,
          hostname: requestUrl.hostname,
          waitUntil: context.waitUntil,
          debug: debugFn,
        }

        await useContentSecurityPolicy(config.contentSecurityPolicy)(
          cspContext,
          async () => {}, // no-op next
        )

        const elapsed = Math.round(getNowMs() - startTime)
        debugFn(`Middleware executed in ${elapsed}ms`)
        return cspContext.response
      }

      const elapsed = Math.round(getNowMs() - startTime)
      debugFn(`Middleware executed in ${elapsed}ms`)
      return response
    } catch (error) {
      // Re-throw redirects and responses
      if (isResponseLike(error)) {
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

import { checkLockStatus } from "../core"
import { useContentSecurityPolicy } from "../middlewares"
import type { UseCSPInput } from "../schemas"
import { ReactRouterCloudflareConfigSchema } from "../schemas/react-router-cloudflare"
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
 * Cloudflare context provided by React Router on Cloudflare Workers.
 * This is the shape of `context.cloudflare` in React Router loaders/actions.
 */
export interface CloudflareContext {
  env: CloudflareEnv
  ctx: ExecutionContext
}

/**
 * Symbol used to store Cloudflare context in RouterContextProvider.
 * This is used when middleware is enabled with the v8_middleware future flag.
 */
export const cloudflareContextSymbol = Symbol.for(
  "@appwarden/middleware:cloudflare",
)

/**
 * Configuration for the Appwarden middleware.
 */
export interface ReactRouterAppwardenConfig {
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
export type ReactRouterConfigFn = (
  cloudflare: CloudflareContext,
) => ReactRouterAppwardenConfig

/**
 * React Router middleware function signature.
 * This matches the unstable_middleware export type in React Router v7.
 *
 * Supports both old and new context APIs:
 * - Old API: context is a plain object with `cloudflare` property
 * - New API (v8_middleware): context is a RouterContextProvider instance
 */
export interface ReactRouterMiddlewareArgs {
  request: Request
  params: Record<string, string | undefined>
  context: any // Can be either plain object or RouterContextProvider
}

export type ReactRouterMiddlewareFunction = (
  args: ReactRouterMiddlewareArgs,
  next: () => Promise<unknown>,
) => Promise<unknown>

const getNowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

/**
 * Helper function to extract Cloudflare context from React Router context.
 * Supports both old and new context APIs.
 *
 * @param context - React Router context (can be plain object or RouterContextProvider)
 * @returns Cloudflare context or null if not found
 */
function getCloudflareContext(context: any): CloudflareContext | null {
  // Try old API first: context.cloudflare
  if (context?.cloudflare) {
    return context.cloudflare
  }

  // Try new API: RouterContextProvider with symbol
  if (context?.get && typeof context.get === "function") {
    try {
      const cloudflare = context.get(cloudflareContextSymbol)
      if (cloudflare) {
        return cloudflare
      }
    } catch {
      // Symbol not found in context, continue
    }
  }

  return null
}

/**
 * Creates an Appwarden middleware function for React Router.
 *
 * This middleware checks if the site is locked and redirects to the lock page if so.
 * It should be exported from your root route (root.tsx) to protect all routes.
 *
 * Supports both old and new React Router context APIs:
 * - Old API: Pass context as plain object with `cloudflare` property
 * - New API (v8_middleware): Use RouterContextProvider with cloudflareContextSymbol
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
 * @param configFn - A function that receives the Cloudflare context and returns the config
 * @returns A React Router middleware function
 */
export function createAppwardenMiddleware(
  configFn: ReactRouterConfigFn,
): ReactRouterMiddlewareFunction {
  return async (args, next) => {
    const startTime = getNowMs()
    const { request, context } = args

    try {
      // Get Cloudflare context from React Router context (supports both APIs)
      const cloudflare = getCloudflareContext(context)
      if (!cloudflare) {
        console.error(
          printMessage(
            "Cloudflare context not found. Make sure you're running on Cloudflare Workers and have set up the context correctly.",
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
        `isHTML: ${isHTML}`,
      )

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTML) {
        return next()
      }

      // Validate config against schema
      const hasError = validateConfig(config, ReactRouterCloudflareConfigSchema)
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

        const elapsed = Math.round(getNowMs() - startTime)
        debugFn(`Middleware executed in ${elapsed}ms`)
        return cspContext.response
      }

      const elapsed = Math.round(getNowMs() - startTime)
      debugFn(`Middleware executed in ${elapsed}ms`)
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

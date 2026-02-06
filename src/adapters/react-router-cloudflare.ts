import { checkLockStatus } from "../core"
import { ReactRouterCloudflareConfigSchema } from "../schemas/react-router-cloudflare"
import {
  buildLockPageUrl,
  createRedirect,
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
 */
export interface ReactRouterMiddlewareArgs {
  request: Request
  params: Record<string, string | undefined>
  context: {
    cloudflare: CloudflareContext
  }
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
 * @param configFn - A function that receives the Cloudflare context and returns the config
 * @returns A React Router middleware function
 */
export function createAppwardenMiddleware(
  configFn: ReactRouterConfigFn,
): ReactRouterMiddlewareFunction {
  return async (args, next) => {
    const { request, context } = args

    try {
      // Get Cloudflare context from React Router context
      const cloudflare = context.cloudflare
      if (!cloudflare) {
        console.error(
          printMessage(
            "Cloudflare context not found. Make sure you're running on Cloudflare Workers.",
          ),
        )
        return next()
      }

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTMLRequest(request)) {
        return next()
      }

      // Get config from the config function
      const config = configFn(cloudflare)
      // Validate config against schema
      const hasError = validateConfig(config, ReactRouterCloudflareConfigSchema)
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
        waitUntil: (fn) => cloudflare.ctx.waitUntil(fn),
      })

      // If locked, redirect to lock page
      if (result.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
        throw createRedirect(lockPageUrl)
      }

      // Continue to next middleware/loader
      return next()
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

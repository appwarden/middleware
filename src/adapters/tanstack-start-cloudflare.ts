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
import { getNowMs } from "../utils/get-now"
import { isResponseLike } from "../utils/is-response-like"

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
 * The result returned by the `next()` function in TanStack Start request middleware.
 *
 * Mirrors the internal `RequestServerResult` interface from `@tanstack/start-client-core`
 * without importing from an unstable internal package path.
 */
export interface TanStackStartNextResult {
  request: Request
  pathname: string
  context: Record<string, unknown>
  response: Response
}

/**
 * The `next()` function passed to TanStack Start request middleware.
 *
 * Mirrors the internal `RequestServerNextFn` signature.
 */
export type TanStackStartNextFn = (options?: {
  context?: Record<string, unknown>
}) => Promise<TanStackStartNextResult>

/**
 * TanStack Start middleware server callback arguments.
 *
 * Mirrors the official TanStack Start `RequestServerOptions` interface, with
 * an additional optional `cloudflare` context property for Cloudflare
 * Workers deployments.
 */
export interface TanStackStartMiddlewareArgs {
  request: Request
  pathname: string
  context: {
    cloudflare?: TanStackStartCloudflareContext
    [key: string]: unknown
  }
  next: TanStackStartNextFn
  serverFnMeta?: unknown
}

/**
 * TanStack Start middleware function signature.
 *
 * Mirrors the official TanStack Start `RequestServerFn` type used for
 * request middleware server functions.
 */
export type TanStackStartMiddlewareFunction = (
  args: TanStackStartMiddlewareArgs,
) => Promise<TanStackStartNextResult | Response>

/**
 *
 * @param configFn - A function that receives the Cloudflare context and returns the config
 * @returns A TanStack Start middleware function
 */
export function createAppwardenMiddleware(
  configFn: TanStackStartConfigFn,
): TanStackStartMiddlewareFunction {
  const middleware: TanStackStartMiddlewareFunction = async (args) => {
    const startTime = getNowMs()
    const { request, next, context } = args

    try {
      // Get Cloudflare context from TanStack Start context
      // If not available, we'll create a stub (user should be importing env directly)
      let cloudflare = context.cloudflare as
        | TanStackStartCloudflareContext
        | undefined

      if (!cloudflare) {
        console.error(
          printMessage(
            "Cloudflare context not found in TanStack Start context. " +
              "Ensure your Register type includes the cloudflare context, or pass it manually in the middleware wrapper.",
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
      const lockStatus = await checkLockStatus({
        request,
        appwardenApiToken: config.appwardenApiToken,
        appwardenApiHostname: config.appwardenApiHostname,
        debug: config.debug,
        lockPageSlug: config.lockPageSlug,
        waitUntil: (fn) => cloudflare.ctx.waitUntil(fn),
      })

      // If locked, throw redirect to lock page
      if (lockStatus.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
        debugFn(`Website is locked - redirecting to ${lockPageUrl.pathname}`)
        throw createRedirect(lockPageUrl)
      }

      debugFn("Website is unlocked")

      // Continue to next middleware/handler and get the result object
      const result = await next()
      const { response } = result

      // Apply CSP if configured (runs after origin)
      if (config.contentSecurityPolicy && isResponseLike(response)) {
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
        return {
          ...result,
          response: cspContext.response,
        }
      }

      const elapsed = Math.round(getNowMs() - startTime)
      debugFn(`Middleware executed in ${elapsed}ms`)
      return result
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

  return middleware
}

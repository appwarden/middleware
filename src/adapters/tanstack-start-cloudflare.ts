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
 * Minimal execution context type for TanStack Start adapter.
 * Only includes the waitUntil method that the adapter actually uses.
 */
export interface TanStackStartExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Minimal runtime context type for TanStack Start adapter.
 * Contains only what the adapter and config function need.
 * Users provide this context by importing env and waitUntil from "cloudflare:workers".
 */
export interface TanStackStartRuntimeContext {
  env: CloudflareEnv
  waitUntil(promise: Promise<unknown>): void
}

/**
 * @deprecated Use TanStackStartRuntimeContext instead.
 * Cloudflare context provided by TanStack Start on Cloudflare Workers.
 * This is the shape of the cloudflare context available in middleware.
 */
export interface TanStackStartCloudflareContext {
  env: CloudflareEnv
  ctx: TanStackStartExecutionContext
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
 * Configuration function that receives the runtime context and returns the config.
 * This allows dynamic configuration based on environment variables.
 * Accepts pre-transformation input types (e.g., string | boolean for debug, string | object for CSP directives).
 */
export type TanStackStartConfigFn = (
  runtime: TanStackStartRuntimeContext,
) => import("../schemas/tanstack-start-cloudflare").TanStackStartAppwardenConfigInput

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
 * Mirrors the official TanStack Start `RequestServerOptions` interface.
 * The context should include env and waitUntil from the Cloudflare Workers runtime.
 */
export interface TanStackStartMiddlewareArgs {
  request: Request
  pathname: string
  context: TanStackStartRuntimeContext & Record<string, unknown>
  next: TanStackStartNextFn
  serverFnMeta?: unknown
}

/**
 * TanStack Start middleware function signature.
 *
 * Mirrors the official TanStack Start `RequestServerFn` type used for
 * request middleware server functions.
 *
 * Note: The middleware either returns TanStackStartNextResult or throws a Response (redirect).
 * Thrown values are not part of the return type.
 */
export type TanStackStartMiddlewareFunction = (
  args: TanStackStartMiddlewareArgs,
) => Promise<TanStackStartNextResult>

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
      // Check if runtime context has required properties
      if (!context.env || !context.waitUntil) {
        console.error(
          printMessage(
            "Runtime context missing required properties (env, waitUntil). " +
              "Ensure you pass { env, waitUntil } from cloudflare:workers to the middleware context.",
          ),
        )
        return next()
      }

      // Get config from the config function (pre-transformation input)
      const rawConfig = configFn(context)

      // Parse and validate config to get transformed output
      const parseResult =
        TanStackStartCloudflareConfigSchema.safeParse(rawConfig)
      if (!parseResult.success) {
        // Log validation errors using validateConfig for user-friendly messages
        validateConfig(rawConfig, TanStackStartCloudflareConfigSchema)
        return next()
      }

      // Use the validated and transformed config
      const config = parseResult.data
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
        waitUntil: context.waitUntil,
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

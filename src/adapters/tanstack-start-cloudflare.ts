import { waitUntil } from "cloudflare:workers"
import { checkLockStatus } from "../core"
import { useContentSecurityPolicy } from "../middlewares"
import type {
  TanStackStartCloudflareConfig,
  TanStackStartCloudflareConfigInput,
} from "../schemas/tanstack-start-cloudflare"
import { TanStackStartCloudflareConfigSchema } from "../schemas/tanstack-start-cloudflare"
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

// Re-export the config types so consumers can reference them from this adapter
// without importing from the internal schema module.
export type {
  TanStackStartCloudflareConfig,
  TanStackStartCloudflareConfigInput,
}

/**
 * Configuration function that returns the config.
 * This allows dynamic configuration based on environment variables from cloudflare:workers.
 * Accepts pre-transformation input types (e.g., string | boolean for debug, string | object for CSP directives).
 */
export type TanStackStartConfigFn = () => TanStackStartCloudflareConfigInput

/**
 * The result returned by the `next()` function in TanStack Start request middleware.
 *
 * Mirrors the internal `RequestServerResult` interface from `@tanstack/start-client-core`
 * without importing from an unstable internal package path.
 *
 * Note: `pathname` remains required here to stay structurally compatible with
 * TanStack's `RequestServerResult` type, which expects a non-optional string.
 * The adapter itself does not use this property, but other parts of TanStack's
 * type system do, so we keep it required on the result while allowing it to be
 * optional on the middleware *args* type.
 */
export interface TanStackStartNextResult {
  request: Request
  pathname: string
  // The adapter does not depend on the shape of this context. TanStack's
  // internal `RequestServerResult` uses a complex `Expand<...>` type here
  // that is not guaranteed to be assignable to `Record<string, unknown>`.
  //
  // To remain structurally compatible while staying type-safe for consumers,
  // we treat the context as `unknown`.
  context: unknown
  response: Response
}

/**
 * The `next()` function passed to TanStack Start request middleware.
 *
 * This mirrors the shape of TanStack's `RequestServerNextFn` from
 * `@tanstack/start-client-core` without importing the type directly.
 *
 * - It accepts an optional options object with an optional `context`.
 * - It may return either a `TanStackStartNextResult` or a Promise of one,
 *   matching TanStack's own union return type
 *   (`Promise<RequestServerResult> | RequestServerResult`).
 * - The adapter itself always calls `next()` with no arguments and awaits it,
 *   so callers are free to pass TanStack's native `next` implementation
 *   directly (`next: next`).
 */
export interface TanStackStartNextOptions<
  TServerContext = Record<string, unknown>,
> {
  context?: TServerContext
}

export type TanStackStartNextFnResult =
  | Promise<TanStackStartNextResult>
  | TanStackStartNextResult

export type TanStackStartNextFn = <TServerContext = Record<string, unknown>>(
  options?: TanStackStartNextOptions<TServerContext>,
) => TanStackStartNextFnResult

/**
 * TanStack Start middleware server callback arguments.
 *
 * Mirrors the official TanStack Start `RequestServerOptions` interface.
 */
export interface TanStackStartMiddlewareArgs {
  request: Request
  /**
   * Optional pathname supplied by TanStack Start. The adapter does not require it,
   * so callers do not need to provide it when constructing harness args manually.
   */
  pathname?: string
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
 * @param configFn - A function that returns the config using env from cloudflare:workers
 * @returns A TanStack Start middleware function
 */
export function createAppwardenMiddleware(
  configFn: TanStackStartConfigFn,
): TanStackStartMiddlewareFunction {
  const middleware: TanStackStartMiddlewareFunction = async (args) => {
    const startTime = getNowMs()
    const { request, next } = args

    try {
      // Get config from the config function (pre-transformation input)
      const rawConfig = configFn()

      // Validate and transform config against schema
      const validationResult =
        TanStackStartCloudflareConfigSchema.safeParse(rawConfig)
      if (!validationResult.success) {
        console.error(
          printMessage(
            `Config validation failed: ${validationResult.error.message}`,
          ),
        )
        return next()
      }

      // Use the validated and transformed config
      const config = validationResult.data
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
        waitUntil,
      })

      // If locked, redirect to the lock page (quarantine) and apply CSP when configured
      if (lockStatus.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
        debugFn(`Website is locked - redirecting to ${lockPageUrl.pathname}`)

        const redirectResponse = createRedirect(lockPageUrl)

        if (config.contentSecurityPolicy && isResponseLike(redirectResponse)) {
          const cspContext = {
            request,
            response: redirectResponse,
            hostname: requestUrl.hostname,
            waitUntil,
            debug: debugFn,
          }

          await useContentSecurityPolicy(config.contentSecurityPolicy)(
            cspContext,
            async () => {},
          )

          const elapsed = Math.round(getNowMs() - startTime)
          debugFn(`Middleware executed in ${elapsed}ms`)
          throw cspContext.response
        }

        const elapsed = Math.round(getNowMs() - startTime)
        debugFn(`Middleware executed in ${elapsed}ms`)
        throw redirectResponse
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
          waitUntil,
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

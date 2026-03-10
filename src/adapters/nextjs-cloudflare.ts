import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"
import { APPWARDEN_HEARTBEAT_ROUTE } from "../constants"
import { checkLockStatus } from "../core"
import type {
  NextJsCloudflareConfig,
  NextJsCloudflareConfigInput,
} from "../schemas/nextjs-cloudflare"
import { NextJsCloudflareConfigSchema } from "../schemas/nextjs-cloudflare"
import {
  buildLockPageUrl,
  debug,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
  TEMPORARY_REDIRECT_STATUS,
} from "../utils"
import { getNowMs, logElapsed } from "../utils/get-now"

/**
 * Cloudflare runtime context provided by @opennextjs/cloudflare.
 * This is the shape of the context returned by getCloudflareContext().
 */
export interface NextJsCloudflareRuntime {
  env: CloudflareEnv
  ctx: ExecutionContext
}

/**
 * Configuration for the Appwarden middleware.
 *
 * This is an alias of the validated output type from
 * NextJsCloudflareConfigSchema, so it always stays in sync with the
 * actual runtime config contract.
 */
export type NextJsCloudflareAppwardenConfig = NextJsCloudflareConfig

// Re-export the config types so consumers can reference them from this adapter
// without importing from the internal schema module.
export type { NextJsCloudflareConfig, NextJsCloudflareConfigInput }

/**
 * Configuration function that receives the Cloudflare runtime and returns the config.
 * This allows dynamic configuration based on environment variables.
 * Accepts pre-transformation input types (e.g., string | boolean for debug, string | object for CSP directives).
 */
export type NextJsCloudflareConfigFn = (
  runtime: NextJsCloudflareRuntime,
) => NextJsCloudflareConfigInput

/**
 * Next.js middleware function signature.
 * Compatible with both middleware.ts and proxy.ts (Next.js 16+).
 */
export type NextJsMiddlewareFunction = (
  request: NextRequest,
  event?: NextFetchEvent,
) => Promise<NextResponse>

/**
 * Creates an Appwarden middleware function for Next.js on Cloudflare.
 *
 * This middleware checks if the site is locked and redirects to the lock page if so.
 * It uses @opennextjs/cloudflare to access Cloudflare bindings and context.
 *
 * @example
 * ```typescript
 * // middleware.ts (or proxy.ts for Next.js 16+)
 * import { createAppwardenMiddleware } from "@appwarden/middleware/opennext-cloudflare"
 *
 * export const config = {
 *   matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
 * }
 *
 * export default createAppwardenMiddleware(({ env }) => ({
 *   lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *   appwardenApiToken: env.APPWARDEN_API_TOKEN,
 * }))
 * ```
 *
 * @param configFn - A function that receives the Cloudflare runtime and returns the config
 * @returns A Next.js middleware function
 */
export function createAppwardenMiddleware(
  configFn: NextJsCloudflareConfigFn,
): NextJsMiddlewareFunction {
  return async (request, _event) => {
    const startTime = getNowMs()

    try {
      const requestUrl = new URL(request.url)

      // Handle heartbeat requests BEFORE any other processing
      // This must work even when the site is locked
      if (requestUrl.pathname === APPWARDEN_HEARTBEAT_ROUTE) {
        try {
          // Dynamic import to avoid bundling issues
          const { getCloudflareContext } =
            await import("@opennextjs/cloudflare")
          const { env, ctx } = getCloudflareContext()

          // Get config from the config function (pre-transformation input)
          const rawConfig = configFn({ env, ctx })

          // Validate config
          const validationResult =
            NextJsCloudflareConfigSchema.safeParse(rawConfig)

          // Import heartbeat utilities
          const { handleHeartbeatRequest, sanitizeConfigErrors } =
            await import("../utils")
          const { HEARTBEAT_SERVICES } = await import("../constants")

          // Return heartbeat response with config errors if validation failed
          const configErrors = validationResult.success
            ? []
            : sanitizeConfigErrors(validationResult.error)

          const response = handleHeartbeatRequest(
            request,
            HEARTBEAT_SERVICES.CLOUDFLARE_NEXTJS,
            configErrors,
          )
          // Convert Response to NextResponse
          return new NextResponse(response.body, response)
        } catch (error) {
          // If we can't get Cloudflare context, return heartbeat with a controlled error
          const { createHeartbeatConfigError, handleHeartbeatRequest } =
            await import("../utils")
          const { HEARTBEAT_SERVICES } = await import("../constants")
          const response = handleHeartbeatRequest(
            request,
            HEARTBEAT_SERVICES.CLOUDFLARE_NEXTJS,
            [
              createHeartbeatConfigError(
                ["context"],
                "custom",
                "Cloudflare context unavailable",
              ),
            ],
          )
          // Convert Response to NextResponse
          return new NextResponse(response.body, response)
        }
      }

      // Dynamic import to avoid bundling issues
      const { getCloudflareContext } = await import("@opennextjs/cloudflare")
      const { env, ctx } = getCloudflareContext()

      // Get config from the config function (pre-transformation input)
      const rawConfig = configFn({ env, ctx })

      // Validate and transform config against schema
      const validationResult = NextJsCloudflareConfigSchema.safeParse(rawConfig)
      if (!validationResult.success) {
        console.error(
          printMessage(
            `Config validation failed: ${validationResult.error.message}`,
          ),
        )
        return NextResponse.next()
      }

      // Use the validated and transformed config
      const config = validationResult.data
      const debugFn = debug(config.debug)
      const isHTML = isHTMLRequest(request)

      debugFn(
        `Appwarden middleware invoked for ${requestUrl.pathname}`,
        `isHTML: ${isHTML}`,
      )

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTML) {
        return NextResponse.next()
      }

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(config.lockPageSlug, request.url)) {
        debugFn("Already on lock page - skipping")
        return NextResponse.next()
      }

      // Check lock status
      const result = await checkLockStatus({
        request,
        appwardenApiToken: config.appwardenApiToken,
        appwardenApiHostname: config.appwardenApiHostname,
        debug: config.debug,
        lockPageSlug: config.lockPageSlug,
        waitUntil: ctx.waitUntil.bind(ctx),
      })

      // If locked, redirect to lock page
      if (result.isLocked) {
        const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
        debugFn(`Website is locked - redirecting to ${lockPageUrl.pathname}`)
        return NextResponse.redirect(lockPageUrl, TEMPORARY_REDIRECT_STATUS)
      }

      debugFn("Site is unlocked")

      // Apply CSP headers if configured (pre-origin, headers only)
      if (
        config.contentSecurityPolicy &&
        config.contentSecurityPolicy.mode !== "disabled"
      ) {
        debugFn(
          `Applying CSP headers in ${config.contentSecurityPolicy.mode} mode`,
        )
        const { makeCSPHeader } = await import("../utils/cloudflare")
        const [headerName, headerValue] = makeCSPHeader(
          "",
          config.contentSecurityPolicy.directives,
          config.contentSecurityPolicy.mode,
        )

        const response = NextResponse.next()
        response.headers.set(headerName, headerValue)
        logElapsed(debugFn, startTime)
        return response
      }

      // Continue to next handler
      logElapsed(debugFn, startTime)
      return NextResponse.next()
    } catch (error) {
      // Log errors but don't block the request
      console.error(
        printMessage(
          `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      return NextResponse.next()
    }
  }
}

import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server"
import { checkLockStatus } from "../core"
import { NextJsCloudflareConfigSchema } from "../schemas/nextjs-cloudflare"
import {
  isHTMLRequest,
  isMonitoringRequest,
  printMessage,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
} from "../utils"

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
 */
export interface NextJsCloudflareAppwardenConfig {
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
export type NextJsCloudflareConfigFn = (
  runtime: NextJsCloudflareRuntime,
) => NextJsCloudflareAppwardenConfig

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
    try {
      // Dynamic import to avoid bundling issues
      const { getCloudflareContext } = await import("@opennextjs/cloudflare")
      const { env, ctx } = await getCloudflareContext()

      const config = configFn({ env, ctx })

      // Skip monitoring requests from Appwarden
      if (isMonitoringRequest(request)) {
        return NextResponse.next()
      }

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTMLRequest(request)) {
        return NextResponse.next()
      }

      // Validate config against schema
      const hasError = validateConfig(config, NextJsCloudflareConfigSchema)
      if (hasError) {
        return NextResponse.next()
      }

      // Check lock status
      const result = await checkLockStatus({
        request,
        appwardenApiToken: config.appwardenApiToken,
        appwardenApiHostname: config.appwardenApiHostname,
        debug: config.debug,
        lockPageSlug: config.lockPageSlug,
        waitUntil: (fn) => ctx.waitUntil(fn),
      })

      // If locked, redirect to lock page
      if (result.isLocked) {
        // Normalize the lock page slug to ensure it starts with /
        const normalizedSlug = config.lockPageSlug.startsWith("/")
          ? config.lockPageSlug
          : `/${config.lockPageSlug}`

        const lockPageUrl = new URL(normalizedSlug, request.url)
        return NextResponse.redirect(lockPageUrl, TEMPORARY_REDIRECT_STATUS)
      }

      // Continue to next handler
      return NextResponse.next()
    } catch (error) {
      // Log errors but don't block the request
      console.error(
        printMessage(
          `Error in Appwarden middleware: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      return NextResponse.next()
    }
  }
}

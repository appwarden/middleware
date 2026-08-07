import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"
import {
  APPWARDEN_CACHE_KEY,
  globalErrors,
  HEARTBEAT_SERVICES,
} from "../constants"
import { LockValueType } from "../schemas"
import { AppwardenConfigSchema, VercelAppwardenConfig } from "../schemas/vercel"
import {
  buildApiLockResponseHeaders,
  buildLockPageUrl,
  debug,
  handleHeartbeatRequest,
  isCacheUrl,
  isHeartbeatRequest,
  isHTMLRequest,
  isOnLockPage,
  MemoryCache,
  pathMatchesAnyPattern,
  printMessage,
  resolveMiddlewareConfig,
  sanitizeConfigErrors,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
} from "../utils"
import { makeCSPHeader } from "../utils/cloudflare"
import { parseMergedConfig } from "../utils/get-appwarden-configuration"
import { toNextResponse } from "../utils/to-next-response"
import { getLockValue, syncEdgeValue } from "../utils/vercel"

export function getAppwardenConfiguration(
  generatedConfig: Record<string, unknown>,
  config: Partial<VercelAppwardenConfig>,
): ReturnType<typeof AppwardenConfigSchema.parse> {
  return parseMergedConfig(
    generatedConfig,
    config as Record<string, unknown>,
    AppwardenConfigSchema.parse,
  )
}

const memoryCache = new MemoryCache<string, LockValueType>({ maxSize: 1 })

/**
 * Safely call waitUntil, falling back to fire-and-forget in non-Vercel environments
 */
function safeWaitUntil(promise: Promise<unknown>): void {
  try {
    waitUntil(promise)
  } catch {
    // In non-Vercel environments (e.g., local dev), fire-and-forget
    promise.catch(console.error)
  }
}

export type VercelMiddlewareFunction = (request: Request) => Promise<Response>

export function createAppwardenMiddleware(
  config: VercelAppwardenConfig,
): VercelMiddlewareFunction {
  return async (request: Request): Promise<Response> => {
    const requestUrl = new URL(request.url)

    // Handle heartbeat requests BEFORE any other processing
    // This must work even when the site is locked
    if (isHeartbeatRequest(request, requestUrl)) {
      const validationResult = AppwardenConfigSchema.safeParse(config)

      // Return heartbeat response with config errors if validation failed
      const configErrors = validationResult.success
        ? []
        : sanitizeConfigErrors(validationResult.error)

      const response = handleHeartbeatRequest(
        request,
        HEARTBEAT_SERVICES.VERCEL,
        configErrors,
      )
      return toNextResponse(response)
    }

    if (validateConfig(config, AppwardenConfigSchema)) {
      // Fail open - pass through to next middleware/handler
      return NextResponse.next()
    }

    const parsedConfig = AppwardenConfigSchema.parse(config)

    const routeConfig = resolveMiddlewareConfig(
      parsedConfig as unknown as Parameters<typeof resolveMiddlewareConfig>[0],
      requestUrl.hostname,
    )
    const domainDebug = routeConfig?.debug ?? parsedConfig.debug ?? false
    const debugFn = debug(domainDebug)

    const applyCspHeaders = (response: Response): Response => {
      const cspConfig =
        routeConfig?.website?.cspMode && routeConfig?.website?.cspDirectives
          ? {
              mode: routeConfig.website.cspMode,
              directives: routeConfig.website.cspDirectives,
            }
          : parsedConfig.contentSecurityPolicy

      if (cspConfig && ["enforced", "report-only"].includes(cspConfig.mode)) {
        const [headerName, headerValue] = makeCSPHeader(
          "",
          cspConfig.directives,
          cspConfig.mode,
        )
        response.headers.set(headerName, headerValue)
      }
      return response
    }

    const createMutableRedirectResponse = (location: string): Response => {
      return new Response(null, {
        status: TEMPORARY_REDIRECT_STATUS,
        headers: {
          Location: location,
        },
      })
    }

    try {
      debugFn(`Appwarden middleware invoked for ${requestUrl.pathname}`)

      // Pass through if no lock page is configured for this hostname
      if (!routeConfig) {
        debugFn("No middleware config for hostname - passing through")
        return applyCspHeaders(NextResponse.next())
      }

      // Bypass paths are always allowed through, regardless of lock status.
      if (
        routeConfig.bypassPaths &&
        routeConfig.bypassPaths.length > 0 &&
        pathMatchesAnyPattern(requestUrl.pathname, routeConfig.bypassPaths)
      ) {
        debugFn("Bypass path matched - passing through")
        return applyCspHeaders(NextResponse.next())
      }

      const lockPageSlug = routeConfig.website?.lockPageSlug
      const hasApiBasePaths =
        routeConfig.api?.basePaths && routeConfig.api.basePaths.length > 0

      // Pass through if neither a website lock page nor API base paths are configured.
      if (!lockPageSlug && !hasApiBasePaths) {
        debugFn("No lock page or API base paths configured - passing through")
        return applyCspHeaders(NextResponse.next())
      }

      // Skip if already on the website lock page to prevent infinite redirect loop.
      if (lockPageSlug && isOnLockPage(lockPageSlug, request.url)) {
        debugFn("Already on lock page - passing through")
        return applyCspHeaders(NextResponse.next())
      }

      // Skip lock check and CSP for non-HTML requests when there are no API base paths.
      // This preserves the legacy behavior of not touching API/static traffic.
      if (!isHTMLRequest(request) && !hasApiBasePaths) {
        debugFn("Non-HTML request without API base paths - passing through")
        return NextResponse.next()
      }

      const provider = isCacheUrl.edgeConfig(parsedConfig.cacheUrl)
        ? ("edge-config" as const)
        : ("upstash" as const)

      debugFn(`Using provider: ${provider}`)

      // Check memory cache first
      const cacheValue = memoryCache.get(APPWARDEN_CACHE_KEY)
      const shouldRecheck = MemoryCache.isExpired(cacheValue)

      // Sync from edge in background if cache is expired or missing
      if (!cacheValue || shouldRecheck) {
        debugFn(
          "Memory cache miss or expired - syncing edge value in background",
          `shouldRecheck=${shouldRecheck}`,
        )
        safeWaitUntil(
          syncEdgeValue({
            requestUrl,
            cacheUrl: parsedConfig.cacheUrl,
            appwardenApiToken: parsedConfig.appwardenApiToken,
            appwardenApiHostname: parsedConfig.appwardenApiHostname,
            vercelApiToken: parsedConfig.vercelApiToken,
            debug: debugFn,
          }),
        )
      }

      // Use cached value or fetch directly
      const lockValue =
        cacheValue ??
        (
          await getLockValue({
            cacheUrl: parsedConfig.cacheUrl,
            keyName: APPWARDEN_CACHE_KEY,
            provider,
          })
        ).lockValue

      if (!lockValue?.isLocked) {
        // Site is not locked - pass through to the next handler
        const response = NextResponse.next()
        debugFn("Site is not locked - passing through")
        return applyCspHeaders(response)
      }

      // Locked: API base paths return the configured API response.
      if (
        hasApiBasePaths &&
        pathMatchesAnyPattern(requestUrl.pathname, routeConfig.api!.basePaths)
      ) {
        const responseConfig = routeConfig.api!.response
        debugFn("API base path matched - returning API lock response")
        return new Response(responseConfig?.body ?? "", {
          status: responseConfig?.status ?? 503,
          headers: buildApiLockResponseHeaders(responseConfig?.headers),
        })
      }

      // Locked: non-HTML requests are not redirected to the lock page.
      if (!isHTMLRequest(request)) {
        debugFn("Non-HTML request detected - passing through")
        return applyCspHeaders(NextResponse.next())
      }

      // Locked: redirect to the website lock page
      if (lockPageSlug) {
        debugFn(`Website is locked - redirecting to ${lockPageSlug}`)
        const lockPageUrl = buildLockPageUrl(lockPageSlug, request.url)
        const redirectResponse = createMutableRedirectResponse(
          lockPageUrl.toString(),
        )
        return applyCspHeaders(redirectResponse)
      }

      // No website lock page configured; pass through.
      return applyCspHeaders(NextResponse.next())
    } catch (e) {
      debugFn(
        "Error in Appwarden Vercel middleware",
        e instanceof Error ? e.message : String(e),
      )
      const message =
        "Appwarden encountered an unknown error. Please contact Appwarden support at https://appwarden.io/join-community."

      if (e instanceof Error) {
        if (!globalErrors.includes(e.message)) {
          console.error(printMessage(`${message} - ${e.message}`))
        }
      } else {
        console.error(printMessage(message))
      }

      // Fail open - pass through to the next handler
      return NextResponse.next()
    }
  }
}

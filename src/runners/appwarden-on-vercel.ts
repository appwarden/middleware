import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"
import {
  APPWARDEN_CACHE_KEY,
  APPWARDEN_HEARTBEAT_ROUTE,
  globalErrors,
  HEARTBEAT_SERVICES,
} from "../constants"
import { LockValueType } from "../schemas"
import { AppwardenConfigSchema, VercelAppwardenConfig } from "../schemas/vercel"
import {
  buildLockPageUrl,
  debug,
  handleHeartbeatRequest,
  isCacheUrl,
  isHTMLRequest,
  isOnLockPage,
  MemoryCache,
  printMessage,
  sanitizeConfigErrors,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
} from "../utils"
import { makeCSPHeader } from "../utils/cloudflare"
import { getLockValue, syncEdgeValue } from "../utils/vercel"

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
    if (requestUrl.pathname === APPWARDEN_HEARTBEAT_ROUTE) {
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
      // Convert Response to NextResponse
      return new NextResponse(response.body, response)
    }

    if (validateConfig(config, AppwardenConfigSchema)) {
      // Fail open - pass through to next middleware/handler
      return NextResponse.next()
    }

    const parsedConfig = AppwardenConfigSchema.parse(config)
    const debugFn = debug(parsedConfig.debug ?? false)

    const applyCspHeaders = (response: Response): Response => {
      const cspConfig = parsedConfig.contentSecurityPolicy
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
      const isHTML = isHTMLRequest(request)

      debugFn(
        `Appwarden middleware invoked for ${requestUrl.pathname}`,
        `isHTML: ${isHTML}`,
      )

      // Pass through non-HTML requests to the next handler
      if (!isHTML) {
        debugFn("Non-HTML request detected - passing through")
        return NextResponse.next()
      }

      // Pass through if no lock page is configured
      if (!parsedConfig.lockPageSlug) {
        debugFn("No lockPageSlug configured - passing through")
        return NextResponse.next()
      }

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(parsedConfig.lockPageSlug, request.url)) {
        debugFn("Already on lock page - passing through")
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

      if (lockValue?.isLocked) {
        debugFn(
          `Website is locked - redirecting to ${parsedConfig.lockPageSlug}`,
        )
        const lockPageUrl = buildLockPageUrl(
          parsedConfig.lockPageSlug,
          request.url,
        )
        const redirectResponse = createMutableRedirectResponse(
          lockPageUrl.toString(),
        )
        return applyCspHeaders(redirectResponse)
      }

      // Site is not locked - pass through to the next handler
      const response = NextResponse.next()
      debugFn("Site is not locked - passing through")
      return applyCspHeaders(response)
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

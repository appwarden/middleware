import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"
import {
  APPWARDEN_CACHE_KEY,
  globalErrors,
  HEARTBEAT_SERVICES,
} from "../constants"
import {
  DEFAULT_API_LOCK_BODY,
  DEFAULT_API_LOCK_STATUS,
  LockValueType,
} from "../schemas"
import { AppwardenConfigSchema, VercelAppwardenConfig } from "../schemas/vercel"
import {
  buildLockPageUrl,
  debug,
  getHeartbeatPublicId,
  handleHeartbeatRequest,
  isCacheUrl,
  isHeartbeatRequest,
  isHTMLRequest,
  isOnLockPage,
  MemoryCache,
  printMessage,
  sanitizeConfigErrors,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
} from "../utils"
import { makeCSPHeader } from "../utils/cloudflare"
import { parseMergedConfig } from "../utils/get-appwarden-configuration"
import { resolveMiddlewareAction } from "../utils/route-matching"
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
      const configErrors = validationResult.success
        ? []
        : sanitizeConfigErrors(validationResult.error)
      const publicId = getHeartbeatPublicId(validationResult, config)

      const response = handleHeartbeatRequest(
        request,
        HEARTBEAT_SERVICES.VERCEL,
        publicId,
        configErrors,
      )
      return toNextResponse(response)
    }

    if (validateConfig(config, AppwardenConfigSchema)) {
      // Fail open - pass through to next middleware/handler
      return NextResponse.next()
    }

    const parsedConfig = AppwardenConfigSchema.parse(config)

    const debugFn = debug(parsedConfig.debug)

    const websiteConfig = parsedConfig.website
    const lockPageSlug = websiteConfig?.lockPageSlug

    const applyCspHeaders = (response: Response): Response => {
      if (
        websiteConfig?.cspMode &&
        ["enforced", "report-only"].includes(websiteConfig.cspMode)
      ) {
        const [headerName, headerValue] = makeCSPHeader(
          "",
          websiteConfig.cspDirectives,
          websiteConfig.cspMode,
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

    const isSiteLocked = async (): Promise<boolean> => {
      const provider = isCacheUrl.edgeConfig(parsedConfig.cacheUrl)
        ? ("edge-config" as const)
        : ("upstash" as const)

      // Check memory cache first
      const cacheValue = memoryCache.get(APPWARDEN_CACHE_KEY)
      const shouldRecheck = MemoryCache.isExpired(cacheValue)

      // Sync from edge in background if cache is expired or missing
      if (!cacheValue || shouldRecheck) {
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

      const lockValue =
        cacheValue ??
        (
          await getLockValue({
            cacheUrl: parsedConfig.cacheUrl,
            keyName: APPWARDEN_CACHE_KEY,
            provider,
          })
        ).lockValue

      return !!lockValue?.isLocked
    }

    try {
      const action = resolveMiddlewareAction(request, parsedConfig)

      debugFn(
        `Appwarden middleware invoked for ${requestUrl.pathname}`,
        `action: ${action}`,
      )

      if (action === null || action === "bypass") {
        return NextResponse.next()
      }

      if (action === "api") {
        if (await isSiteLocked()) {
          const responseConfig = parsedConfig.api?.response ?? {
            status: DEFAULT_API_LOCK_STATUS,
            body: DEFAULT_API_LOCK_BODY,
          }
          const headers = new Headers()
          responseConfig.headers?.forEach(({ name, value }) => {
            headers.set(name, value)
          })
          return new Response(responseConfig.body, {
            status: responseConfig.status,
            headers,
          })
        }
        return NextResponse.next()
      }

      // action === "website"
      if (!isHTMLRequest(request)) {
        return NextResponse.next()
      }

      if (!lockPageSlug) {
        return NextResponse.next()
      }

      if (isOnLockPage(lockPageSlug, request.url)) {
        return NextResponse.next()
      }

      if (await isSiteLocked()) {
        const lockPageUrl = buildLockPageUrl(lockPageSlug, request.url)
        const redirectResponse = createMutableRedirectResponse(
          lockPageUrl.toString(),
        )
        return applyCspHeaders(redirectResponse)
      }

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

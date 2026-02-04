import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"
import { APPWARDEN_CACHE_KEY, globalErrors } from "../constants"
import { LockValueType } from "../schemas"
import { AppwardenConfigSchema, VercelAppwardenConfig } from "../schemas/vercel"
import {
  debug,
  getErrors,
  isCacheUrl,
  isHTMLRequest,
  isMonitoringRequest,
  MemoryCache,
  printMessage,
} from "../utils"
import { getLockValue, syncEdgeValue } from "../utils/vercel"

// we use this log to search vercel logs during testing (see packages/appwarden-vercel/edge-cache-testing-results.md)
debug("Instantiating isolate")

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
    const parsedConfig = AppwardenConfigSchema.safeParse(config)
    if (!parsedConfig.success) {
      for (const error of getErrors(parsedConfig.error)) {
        console.error(printMessage(error as string))
      }
      // Fail open - pass through to next middleware/handler
      return NextResponse.next()
    }

    try {
      const requestUrl = new URL(request.url)
      const isHTML = isHTMLRequest(request)
      const isMonitoring = isMonitoringRequest(request)

      debug({ isHTMLRequest: isHTML, url: requestUrl.pathname })

      // Pass through non-HTML and monitoring requests to the next handler
      if (!isHTML || isMonitoring) {
        return NextResponse.next()
      }

      // Pass through if no lock page is configured
      if (!parsedConfig.data.lockPageSlug) {
        return NextResponse.next()
      }

      const provider = isCacheUrl.edgeConfig(parsedConfig.data.cacheUrl)
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
            cacheUrl: parsedConfig.data.cacheUrl,
            appwardenApiToken: parsedConfig.data.appwardenApiToken,
            vercelApiToken: parsedConfig.data.vercelApiToken,
          }),
        )
      }

      // Use cached value or fetch directly
      const lockValue =
        cacheValue ??
        (
          await getLockValue({
            cacheUrl: parsedConfig.data.cacheUrl,
            keyName: APPWARDEN_CACHE_KEY,
            provider,
          })
        ).lockValue

      if (lockValue?.isLocked) {
        const lockPageUrl = new URL(parsedConfig.data.lockPageSlug, request.url)
        return Response.redirect(lockPageUrl.toString(), 302)
      }

      // Site is not locked - pass through to the next handler
      return NextResponse.next()
    } catch (e) {
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

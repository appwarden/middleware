import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"
import { APPWARDEN_CACHE_KEY, globalErrors } from "../constants"
import { LockValueType } from "../schemas"
import { AppwardenConfigSchema, VercelAppwardenConfig } from "../schemas/vercel"
import {
  buildLockPageUrl,
  debug,
  isCacheUrl,
  isHTMLRequest,
  isOnLockPage,
  MemoryCache,
  printMessage,
  TEMPORARY_REDIRECT_STATUS,
  validateConfig,
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
    if (validateConfig(config, AppwardenConfigSchema)) {
      // Fail open - pass through to next middleware/handler
      return NextResponse.next()
    }

    const parsedConfig = AppwardenConfigSchema.parse(config)

    try {
      const requestUrl = new URL(request.url)
      const isHTML = isHTMLRequest(request)

      debug({ isHTMLRequest: isHTML, url: requestUrl.pathname })

      // Pass through non-HTML requests to the next handler
      if (!isHTML) {
        return NextResponse.next()
      }

      // Pass through if no lock page is configured
      if (!parsedConfig.lockPageSlug) {
        return NextResponse.next()
      }

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(parsedConfig.lockPageSlug, request.url)) {
        return NextResponse.next()
      }

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
            vercelApiToken: parsedConfig.vercelApiToken,
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
        const lockPageUrl = buildLockPageUrl(
          parsedConfig.lockPageSlug,
          request.url,
        )
        return Response.redirect(
          lockPageUrl.toString(),
          TEMPORARY_REDIRECT_STATUS,
        )
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

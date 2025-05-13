import { NextMiddlewareResult } from "next/dist/server/web/types"
import { NextFetchEvent, NextRequest, NextResponse } from "next/server"
import {
  APPWARDEN_CACHE_KEY,
  APPWARDEN_USER_AGENT,
  globalErrors,
} from "../constants"
import { LockValueType } from "../schemas"
import {
  AppwardenConfigSchema,
  BaseNextJsConfigFnType,
} from "../schemas/vercel"
import { VercelProviderContext } from "../types"
import {
  debug,
  getErrors,
  handleVercelRequest,
  isCacheUrl,
  MemoryCache,
  printMessage,
} from "../utils"
import { syncEdgeValue } from "../utils/vercel"

// we use this log to search vercel logs during testing (see packages/appwarden-vercel/edge-cache-testing-results.md)
debug("Instantiating isolate")

const renderLockPage = (context: VercelProviderContext) => {
  context.req.nextUrl.pathname = context.lockPageSlug
  return NextResponse.rewrite(context.req.nextUrl, {
    headers: {
      // no browser caching, otherwise we need to hard refresh to disable lock screen
      "Cache-Control": "no-store",
    },
  })
}

const memoryCache = new MemoryCache<string, LockValueType>({ maxSize: 1 })

export const appwardenOnVercel =
  (input: BaseNextJsConfigFnType) =>
  async (
    req: NextRequest,
    event: NextFetchEvent,
  ): Promise<NextMiddlewareResult> => {
    event.passThroughOnException()

    const parsedConfig = AppwardenConfigSchema.safeParse(input)
    if (!parsedConfig.success) {
      for (const error of getErrors(parsedConfig.error)) {
        console.error(printMessage(error as string))
      }

      return NextResponse.next()
    }

    try {
      const requestUrl = new URL(req.url)

      const isHTMLRequest = req.headers.get("accept")?.includes("text/html")
      const isMonitoringRequest =
        req.headers.get("User-Agent") === APPWARDEN_USER_AGENT

      debug({
        isHTMLRequest,
        url: requestUrl.pathname,
      })

      // ignore non-html requests
      if (isHTMLRequest && !isMonitoringRequest) {
        let appwardenResponse: NextResponse<unknown> | undefined = undefined
        const context = {
          req,
          event,
          requestUrl,
          memoryCache,
          waitUntil: (fn: any) => event.waitUntil(fn),
          keyName: APPWARDEN_CACHE_KEY,
          provider: isCacheUrl.edgeConfig(parsedConfig.data.cacheUrl)
            ? ("edge-config" as const)
            : ("upstash" as const),
          ...parsedConfig.data,
        }

        const cacheValue = await handleVercelRequest(context, {
          onLocked: () => {
            appwardenResponse = renderLockPage(context)
          },
        })

        const shouldRecheck = MemoryCache.isExpired(cacheValue)
        // if the cache value is expired, sync it from the edge
        // this runs in a waitUntil to reduce middleware execution time
        // the waitUntil must be called from the top level function otherwise the api request gets canceled.
        if (!cacheValue || shouldRecheck) {
          event.waitUntil(syncEdgeValue(context))
        }

        // if the appwardenResponse is a NextResponse, return it immediately to avoid running the after middleware,
        // which may override the rewrite when lock is enabled.
        if (appwardenResponse) {
          return appwardenResponse
        }
      }
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

      throw e
    }

    return NextResponse.next()
  }

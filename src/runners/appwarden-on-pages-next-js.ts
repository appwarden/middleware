import { getRequestContext } from "@cloudflare/next-on-pages"
import { Cache } from "@cloudflare/workers-types"
import { NextResponse, type NextMiddleware } from "next/server"
import { APPWARDEN_CACHE_KEY } from "../constants"
import {
  handleResetCache,
  isResetCacheRequest,
  maybeQuarantine,
} from "../handlers"
import {
  LockValueType,
  NextJsConfigFnOutputSchema,
  NextJsConfigFnType,
} from "../schemas"
import { CloudflareProviderContext } from "../types"
import { debug, printMessage, renderLockPage } from "../utils"
import { store } from "../utils/cloudflare"

debug("Instantiating isolate")

/**
 *
 * @deprecated
 * Please use `import { withAppwarden } from "@appwarden/middleware/cloudflare"` instead
 */
export const appwardenOnPagesNextJs =
  (inputFn: NextJsConfigFnType): NextMiddleware =>
  async (request, event) => {
    const parsedInput = NextJsConfigFnOutputSchema.safeParse(inputFn)
    if (!parsedInput.success) {
      console.error(
        printMessage(`Input validation failed ${parsedInput.error.message}`),
      )
      return null
    }

    const input = parsedInput.data(getRequestContext())

    try {
      const requestUrl = new URL(request.url)

      const provider = "cloudflare-cache" as const
      const keyName = APPWARDEN_CACHE_KEY
      const edgeCache = store.json<LockValueType>(
        {
          serviceOrigin: requestUrl.origin,
          cache: (await caches.open("appwarden:lock")) as unknown as Cache,
        },
        keyName,
      )

      if (isResetCacheRequest(request)) {
        await handleResetCache(keyName, provider, edgeCache, request)
        return NextResponse.next()
      }

      const acceptHeader = request.headers.get("accept")
      const isHTMLRequest = acceptHeader?.includes("text/html")

      debug({
        acceptHeader,
        isHTMLRequest,
        url: requestUrl.pathname,
      })

      // ignore non-html requests
      if (isHTMLRequest) {
        // Resolve lockPageSlug from multidomainConfig or root config
        const lockPageSlug =
          input.multidomainConfig?.[requestUrl.hostname]?.lockPageSlug ??
          input.lockPageSlug

        // If no lockPageSlug is resolved, skip lock logic for this domain
        if (!lockPageSlug) {
          return NextResponse.next()
        }

        let appwardenResponse: Promise<Response> | undefined = undefined

        const context: CloudflareProviderContext = {
          keyName,
          request,
          edgeCache,
          requestUrl,
          provider,
          waitUntil: (fn: any) => event.waitUntil(fn),
          ...input,
          lockPageSlug,
        }

        await maybeQuarantine(context, {
          onLocked: async () => {
            appwardenResponse = renderLockPage(context)
          },
        })

        if (appwardenResponse) {
          return appwardenResponse
        }
      }
    } catch (e) {
      const message =
        "Appwarden encountered an unknown error. Please contact Appwarden support at https://appwarden.io/join-community."

      console.error(
        printMessage(
          e instanceof Error
            ? `${message} - ${e.message}\n${e.stack}`
            : message,
        ),
      )
    }

    return NextResponse.next()
  }

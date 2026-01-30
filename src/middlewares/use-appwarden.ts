import { APPWARDEN_CACHE_KEY, APPWARDEN_USER_AGENT } from "../constants"
import {
  handleResetCache,
  isResetCacheRequest,
  maybeQuarantine,
} from "../handlers"
import { CloudflareConfigType, LockValueType } from "../schemas"
import { CloudflareProviderContext, Middleware } from "../types"
import { printMessage, renderLockPage } from "../utils"
import { store } from "../utils/cloudflare"

export const useAppwarden: (input: CloudflareConfigType) => Middleware =
  (input) => async (context, next) => {
    // run the middleware after the origin is fetched
    await next()

    const { request, response } = context

    try {
      const requestUrl = new URL(request.url)
      const provider = "cloudflare-cache" as const
      const keyName = APPWARDEN_CACHE_KEY
      // we don't set a TTL on this cache to avoid the site rendering when quarantined
      // between when the cache expires and when the latest sync happens to set the cache again
      const edgeCache = store.json<LockValueType>(
        {
          serviceOrigin: requestUrl.origin,
          cache: (await caches.open("appwarden:lock")) as unknown as Cache,
        },
        keyName,
      )

      if (isResetCacheRequest(request)) {
        await handleResetCache(keyName, provider, edgeCache, request)

        return
      }

      const isHTMLRequest = response.headers
        .get("Content-Type")
        ?.includes("text/html")
      const isMonitoringRequest =
        request.headers.get("User-Agent") === APPWARDEN_USER_AGENT

      if (isHTMLRequest && !isMonitoringRequest) {
        const lockPageSlug =
          input.multidomainConfig?.[requestUrl.hostname]?.lockPageSlug ??
          input.lockPageSlug

        // If no lockPageSlug is resolved, skip lock logic for this domain
        if (!lockPageSlug) {
          return
        }

        const innerContext: CloudflareProviderContext = {
          keyName,
          request,
          edgeCache,
          requestUrl,
          provider,
          debug: input.debug,
          lockPageSlug,
          appwardenApiToken: input.appwardenApiToken,
          waitUntil: (fn: any) => context.waitUntil(fn),
        }

        await maybeQuarantine(innerContext, {
          onLocked: async () => {
            context.response = await renderLockPage(innerContext)
          },
        })
      }
    } catch (e) {
      const message =
        "Appwarden encountered an unknown error. Please contact Appwarden support at https://appwarden.io/join-community."

      console.error(
        printMessage(
          e instanceof Error ? `${message} - ${e.message}` : message,
        ),
      )
    }
  }

import { APPWARDEN_CACHE_KEY } from "../constants"
import { checkLockStatus } from "../core"
import { handleResetCache, isResetCacheRequest } from "../handlers"
import { CloudflareConfigType, LockValueType } from "../schemas"
import { Middleware } from "../types"
import { isHTMLResponse, printMessage, renderLockPage } from "../utils"
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

      if (isHTMLResponse(response)) {
        // Resolve lockPageSlug from multidomainConfig (if hostname exists) or fall back to top-level config.
        // If neither provides a lockPageSlug, this domain is not protected and lock logic is skipped.
        const lockPageSlug =
          input.multidomainConfig?.[requestUrl.hostname]?.lockPageSlug ??
          input.lockPageSlug

        if (!lockPageSlug) {
          return
        }

        // Check lock status using the core function
        const result = await checkLockStatus({
          request,
          appwardenApiToken: input.appwardenApiToken,
          appwardenApiHostname: input.appwardenApiHostname,
          debug: input.debug,
          lockPageSlug,
          waitUntil: (fn) => context.waitUntil(fn),
        })

        // If locked, render the lock page
        if (result.isLocked) {
          context.response = await renderLockPage({
            lockPageSlug,
            requestUrl,
          })
        }
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

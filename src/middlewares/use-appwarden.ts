import { APPWARDEN_CACHE_KEY } from "../constants"
import { checkLockStatus } from "../core"
import { handleResetCache, isResetCacheRequest } from "../handlers"
import { CloudflareConfigType, LockValueType } from "../schemas"
import { Middleware } from "../types"
import {
  isHTMLRequest,
  isOnLockPage,
  printMessage,
  renderLockPage,
} from "../utils"
import { store } from "../utils/cloudflare"

export const useAppwarden: (input: CloudflareConfigType) => Middleware =
  (input) => async (context, next) => {
    const { request } = context

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

      // Handle reset cache request
      if (isResetCacheRequest(request)) {
        await handleResetCache(keyName, provider, edgeCache, request)
        return
      }

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTMLRequest(request)) {
        await next()
        return
      }

      // Resolve lockPageSlug from multidomainConfig (if hostname exists) or fall back to top-level config.
      // If neither provides a lockPageSlug, this domain is not protected and lock logic is skipped.
      const lockPageSlug =
        input.multidomainConfig?.[requestUrl.hostname]?.lockPageSlug ??
        input.lockPageSlug

      if (!lockPageSlug) {
        await next()
        return
      }

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(lockPageSlug, request.url)) {
        await next()
        return
      }

      // Check lock status BEFORE fetching the origin
      // This prevents the streaming SSR flash issue on React Router/TanStack Start frameworks
      const result = await checkLockStatus({
        request,
        appwardenApiToken: input.appwardenApiToken,
        appwardenApiHostname: input.appwardenApiHostname,
        debug: input.debug,
        lockPageSlug,
        waitUntil: (fn) => context.waitUntil(fn),
      })

      // If locked, render the lock page directly without fetching the origin
      if (result.isLocked) {
        context.response = await renderLockPage({
          lockPageSlug,
          requestUrl,
        })
        return
      }

      // Not locked, proceed to fetch the origin
      await next()
    } catch (e) {
      const message =
        "Appwarden encountered an unknown error. Please contact Appwarden support at https://appwarden.io/join-community."

      console.error(
        printMessage(
          e instanceof Error ? `${message} - ${e.message}` : message,
        ),
      )

      // On error, still proceed to fetch the origin
      await next()
    }
  }

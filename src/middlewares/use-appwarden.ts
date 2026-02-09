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
    let shouldCallNext = true

    try {
      const requestUrl = new URL(request.url)

      // Handle reset cache request
      // Only initialize edge cache for reset-cache requests to avoid duplicate Cache API calls
      // (checkLockStatus opens its own cache internally)
      if (isResetCacheRequest(request)) {
        const provider = "cloudflare-cache" as const
        const keyName = APPWARDEN_CACHE_KEY
        const edgeCache = store.json<LockValueType>(
          {
            serviceOrigin: requestUrl.origin,
            cache: (await caches.open("appwarden:lock")) as unknown as Cache,
          },
          keyName,
        )
        await handleResetCache(keyName, provider, edgeCache, request)
        // Explicitly set a 204 No Content response for the reset-cache endpoint
        context.response = new Response(null, { status: 204 })
        shouldCallNext = false
        return
      }

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTMLRequest(request)) {
        return
      }

      // Resolve lockPageSlug from multidomainConfig (if hostname exists) or fall back to top-level config.
      // If neither provides a lockPageSlug, this domain is not protected and lock logic is skipped.
      const lockPageSlug =
        input.multidomainConfig?.[requestUrl.hostname]?.lockPageSlug ??
        input.lockPageSlug

      if (!lockPageSlug) {
        return
      }

      // Skip if already on lock page to prevent infinite redirect loop
      if (isOnLockPage(lockPageSlug, request.url)) {
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
        shouldCallNext = false
        return
      }
    } catch (e) {
      const message =
        "Appwarden encountered an unknown error. Please contact Appwarden support at https://appwarden.io/join-community."

      console.error(
        printMessage(
          e instanceof Error ? `${message} - ${e.message}` : message,
        ),
      )
    } finally {
      if (shouldCallNext) {
        await next()
      }
    }
  }

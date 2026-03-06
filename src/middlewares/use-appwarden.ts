import { checkLockStatus } from "../core"
import { CloudflareConfigType } from "../schemas"
import { Middleware } from "../types"
import {
  buildLockPageUrl,
  createRedirect,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
} from "../utils"

export const useAppwarden: (input: CloudflareConfigType) => Middleware =
  (input) => async (context, next) => {
    const { request } = context
    let shouldCallNext = true

    try {
      const requestUrl = new URL(request.url)

      // Skip OPTIONS requests (CORS preflight) to avoid delaying them with lock checks
      // OPTIONS requests should be handled quickly and don't need lock protection
      if (request.method.toUpperCase() === "OPTIONS") {
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

      // If locked, redirect to the lock page
      if (result.isLocked) {
        const lockPageUrl = buildLockPageUrl(lockPageSlug, request.url)
        context.response = createRedirect(lockPageUrl)
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

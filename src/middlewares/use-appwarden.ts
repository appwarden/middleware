import { checkLockStatus } from "../core"
import { CloudflareConfigType } from "../schemas"
import { Middleware } from "../types"
import {
  buildApiLockResponseHeaders,
  buildLockPageUrl,
  createRedirect,
  debug,
  isHTMLRequest,
  isOnLockPage,
  pathMatchesAnyPattern,
  printMessage,
  resolveMiddlewareConfig,
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

      // Resolve the effective middleware configuration for this hostname.
      // When the new route-based `middleware` array is provided, it is used.
      // Otherwise, the legacy lockPageSlug/multidomainConfig shape is synthesized.
      const routeConfig = resolveMiddlewareConfig(input, requestUrl.hostname)
      if (!routeConfig) {
        return
      }

      const domainDebug = routeConfig.debug ?? input.debug ?? false
      const debugFn = debug(domainDebug)

      // Bypass paths are always allowed through, regardless of lock status.
      if (
        routeConfig.bypassPaths &&
        routeConfig.bypassPaths.length > 0 &&
        pathMatchesAnyPattern(requestUrl.pathname, routeConfig.bypassPaths)
      ) {
        debugFn("Bypass path matched - passing through")
        return
      }

      const lockPageSlug = routeConfig.website?.lockPageSlug
      const hasApiBasePaths =
        routeConfig.api?.basePaths && routeConfig.api.basePaths.length > 0

      // Nothing to do if neither a website lock page nor API base paths are configured.
      if (!lockPageSlug && !hasApiBasePaths) {
        return
      }

      // Skip lock check for non-HTML requests when there are no API base paths.
      // This preserves the legacy behavior of not touching API/static traffic.
      if (!isHTMLRequest(request) && !hasApiBasePaths) {
        return
      }

      // Skip if already on the website lock page to prevent infinite redirect loop.
      if (lockPageSlug && isOnLockPage(lockPageSlug, request.url)) {
        return
      }

      // Check lock status BEFORE fetching the origin
      // This prevents the streaming SSR flash issue on React Router/TanStack Start frameworks
      const result = await checkLockStatus({
        request,
        appwardenApiToken: input.appwardenApiToken,
        appwardenApiHostname: input.appwardenApiHostname,
        debug: domainDebug,
        lockPageSlug,
        waitUntil: (fn) => context.waitUntil(fn),
      })

      if (!result.isLocked) {
        return
      }

      // Locked: API base paths return the configured API response.
      if (
        hasApiBasePaths &&
        pathMatchesAnyPattern(requestUrl.pathname, routeConfig.api!.basePaths)
      ) {
        const responseConfig = routeConfig.api!.response
        debugFn("API base path matched - returning API lock response")
        context.response = new Response(responseConfig?.body ?? "", {
          status: responseConfig?.status ?? 503,
          headers: buildApiLockResponseHeaders(responseConfig?.headers),
        })
        shouldCallNext = false
        return
      }

      // Locked: non-HTML requests are not redirected to the lock page.
      if (!isHTMLRequest(request)) {
        return
      }

      // Locked: redirect to the website lock page
      if (lockPageSlug) {
        const lockPageUrl = buildLockPageUrl(lockPageSlug, request.url)
        context.response = createRedirect(lockPageUrl)
        shouldCallNext = false
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

import { checkLockStatus } from "../core"
import {
  CloudflareConfigType,
  DEFAULT_API_LOCK_BODY,
  DEFAULT_API_LOCK_STATUS,
} from "../schemas"
import { Middleware } from "../types"
import {
  buildLockPageUrl,
  createRedirect,
  debug,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
} from "../utils"
import { resolveMiddlewareAction } from "../utils/route-matching"

export const useAppwarden: (input: CloudflareConfigType) => Middleware =
  (input) => async (context, next) => {
    const { request, hostname } = context
    let shouldCallNext = true

    try {
      // Skip OPTIONS requests (CORS preflight) to avoid delaying them with lock checks
      if (request.method.toUpperCase() === "OPTIONS") {
        return
      }

      const domainOverride = input.multidomainConfig?.[hostname]
      const resolvedOptions = {
        debug: input.debug,
        bypassPaths: input.bypassPaths,
        website: input.website,
        api: input.api,
        appwardenApiToken: input.appwardenApiToken,
        appwardenApiHostname: input.appwardenApiHostname,
        ...domainOverride,
      }
      const debugFn = debug(resolvedOptions.debug)

      const action = resolveMiddlewareAction(request, resolvedOptions)

      if (action === null) {
        return
      }

      if (action === "bypass") {
        debugFn(
          `Bypassing path: ${new URL(request.url).pathname} due to bypassPaths match`,
        )
        return
      }

      if (action === "api") {
        const result = await checkLockStatus({
          request,
          appwardenApiToken: resolvedOptions.appwardenApiToken,
          appwardenApiHostname: resolvedOptions.appwardenApiHostname,
          debug: resolvedOptions.debug,
          lockPageSlug: resolvedOptions.website?.lockPageSlug,
          waitUntil: (fn) => context.waitUntil(fn),
        })

        if (result.isLocked) {
          const responseConfig = resolvedOptions.api?.response ?? {
            status: DEFAULT_API_LOCK_STATUS,
            body: DEFAULT_API_LOCK_BODY,
          }
          const headers = new Headers()
          responseConfig.headers?.forEach(({ name, value }) => {
            headers.set(name, value)
          })
          context.response = new Response(responseConfig.body, {
            status: responseConfig.status,
            headers,
          })
          shouldCallNext = false
        }
        return
      }

      if (action === "website") {
        if (!isHTMLRequest(request)) {
          return
        }

        const lockPageSlug =
          resolvedOptions.website?.lockPageSlug ?? "/maintenance"

        if (isOnLockPage(lockPageSlug, request.url)) {
          return
        }

        const result = await checkLockStatus({
          request,
          appwardenApiToken: resolvedOptions.appwardenApiToken,
          appwardenApiHostname: resolvedOptions.appwardenApiHostname,
          debug: resolvedOptions.debug,
          lockPageSlug,
          waitUntil: (fn) => context.waitUntil(fn),
        })

        if (result.isLocked) {
          const lockPageUrl = buildLockPageUrl(lockPageSlug, request.url)
          context.response = createRedirect(lockPageUrl)
          shouldCallNext = false
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
    } finally {
      if (shouldCallNext) {
        await next()
      }
    }
  }

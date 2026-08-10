import { checkLockStatus } from "../core"
import {
  AppwardenMiddlewareConfigType,
  DEFAULT_API_LOCK_BODY,
  DEFAULT_API_LOCK_STATUS,
} from "../schemas"
import { buildLockPageUrl, isOnLockPage } from "./build-lock-page-url"
import { isHTMLRequest } from "./request-checks"
import { resolveMiddlewareAction } from "./route-matching"

export type AdapterAction =
  | { type: "bypass" }
  | { type: "api-locked"; response: Response }
  | { type: "api-unlocked" }
  | { type: "website-locked"; lockPageUrl: URL }
  | { type: "website-unlocked" }
  | { type: "no-config" }

export const resolveAdapterAction = async (
  request: Request,
  config: AppwardenMiddlewareConfigType,
  waitUntil: (fn: Promise<unknown>) => void,
): Promise<AdapterAction> => {
  const action = resolveMiddlewareAction(request, config)

  if (action === null) {
    return { type: "no-config" }
  }

  if (action === "bypass") {
    return { type: "bypass" }
  }

  if (action === "api") {
    const result = await checkLockStatus({
      request,
      appwardenApiToken: config.appwardenApiToken,
      appwardenApiHostname: config.appwardenApiHostname,
      debug: config.debug,
      lockPageSlug: config.website?.lockPageSlug,
      waitUntil,
    })

    if (result.isLocked) {
      const responseConfig = config.api?.response ?? {
        status: DEFAULT_API_LOCK_STATUS,
        body: DEFAULT_API_LOCK_BODY,
      }
      const headers = new Headers()
      responseConfig.headers?.forEach(({ name, value }) => {
        headers.set(name, value)
      })
      return {
        type: "api-locked",
        response: new Response(responseConfig.body, {
          status: responseConfig.status,
          headers,
        }),
      }
    }

    return { type: "api-unlocked" }
  }

  // action === "website"
  if (!isHTMLRequest(request)) {
    return { type: "website-unlocked" }
  }

  const lockPageSlug = config.website?.lockPageSlug ?? "/maintenance"

  if (isOnLockPage(lockPageSlug, request.url)) {
    return { type: "website-unlocked" }
  }

  const result = await checkLockStatus({
    request,
    appwardenApiToken: config.appwardenApiToken,
    appwardenApiHostname: config.appwardenApiHostname,
    debug: config.debug,
    lockPageSlug,
    waitUntil,
  })

  if (result.isLocked) {
    return {
      type: "website-locked",
      lockPageUrl: buildLockPageUrl(lockPageSlug, request.url),
    }
  }

  return { type: "website-unlocked" }
}

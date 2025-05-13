import { APPWARDEN_TEST_ROUTE } from "../constants"
import { CloudflareProviderContext } from "../types"
import { MemoryCache } from "../utils"
import {
  deleteEdgeValue,
  getLockValue,
  syncEdgeValue,
} from "../utils/cloudflare"

const resolveLockValue = async (
  context: CloudflareProviderContext,
  options: {
    onLocked: () => Promise<void>
  },
) => {
  const { lockValue, shouldDeleteEdgeValue } = await getLockValue(context)

  if (shouldDeleteEdgeValue) {
    await deleteEdgeValue(context)
  }

  if (
    lockValue?.isLocked ||
    (context.requestUrl.pathname === APPWARDEN_TEST_ROUTE &&
      !MemoryCache.isTestExpired(lockValue))
  ) {
    await options.onLocked()
  }

  return lockValue
}

export const maybeQuarantine = async (
  context: CloudflareProviderContext,
  options: {
    onLocked: () => Promise<void>
  },
) => {
  const cachedLockValue = await resolveLockValue(context, {
    onLocked: options.onLocked,
  })

  const shouldRecheck = MemoryCache.isExpired(cachedLockValue)
  // sync the edge value synchronously if theres no cache value or if cachedLockValue.isLocked and shouldRecheck to avoid rendering an incorrect lock state
  // (e.g. site should be locked, but cache is empty so we render unlocked state)
  // otherwise, sync is asynchronous to avoid blocking the middleware
  if (shouldRecheck) {
    if (!cachedLockValue || cachedLockValue.isLocked) {
      await syncEdgeValue(context)

      await resolveLockValue(context, {
        onLocked: options.onLocked,
      })
    } else {
      // the waitUntil must be called from the top level function otherwise the api request gets canceled.
      // if the appwardenResponse is a NextResponse, return it immediately to avoid running the after middleware,
      // which may override the rewrite when lock is enabled.
      // note to self: check if its getting canceled because of the waitUntil context issue here
      // https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
      context.waitUntil(syncEdgeValue(context))
    }
  }
}

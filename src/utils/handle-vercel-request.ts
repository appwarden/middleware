import { APPWARDEN_TEST_ROUTE } from "../constants"
import { VercelProviderContext } from "../types"
import { MemoryCache } from "./memory-cache"
import { deleteEdgeValue, getLockValue } from "./vercel"

export const handleVercelRequest = async (
  context: VercelProviderContext,
  options: {
    onLocked: () => void
  },
) => {
  let cachedLockValue = context.memoryCache.get(context.keyName)

  const shouldRecheck = MemoryCache.isExpired(cachedLockValue)

  // if the value isn't cached due or worker reset or is expired, refetch it frome the edge
  if (shouldRecheck) {
    const { lockValue, shouldDeleteEdgeValue } = await getLockValue(context)

    if (lockValue) {
      context.memoryCache.put(context.keyName, lockValue)
    }

    if (shouldDeleteEdgeValue) {
      await deleteEdgeValue(context)
    }

    cachedLockValue = lockValue
  }

  if (
    cachedLockValue?.isLocked ||
    (context.requestUrl.pathname === APPWARDEN_TEST_ROUTE &&
      !MemoryCache.isTestExpired(cachedLockValue))
  ) {
    options.onLocked()
  }

  return cachedLockValue
}

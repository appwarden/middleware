import { APPWARDEN_CACHE_KEY, APPWARDEN_TEST_ROUTE } from "../constants"
import { LockValueType } from "../schemas"
import { CloudflareProviderContext } from "../types"
import { MemoryCache } from "../utils"
import {
  deleteEdgeValue,
  getLockValue,
  store,
  syncEdgeValue,
} from "../utils/cloudflare"

/**
 * Configuration for the check lock status function.
 * This is a framework-agnostic interface that can be used by any adapter.
 */
export interface CheckLockConfig {
  /** The incoming request */
  request: Request
  /** The Appwarden API token for authentication */
  appwardenApiToken: string
  /** Optional custom API hostname (defaults to https://api.appwarden.io) */
  appwardenApiHostname?: string
  /** Enable debug logging */
  debug?: boolean
  /** waitUntil function for background tasks (Cloudflare Workers) */
  waitUntil: (fn: Promise<unknown>) => void
  /** The lock page slug - used to construct the context */
  lockPageSlug: string
}

/**
 * The result of checking lock status.
 */
export interface CheckLockResult {
  /** Whether the site is currently locked */
  isLocked: boolean
  /** Whether this is a test lock (temporary lock for testing) */
  isTestLock: boolean
}

/**
 * Creates a CloudflareProviderContext from the check lock config.
 * This allows us to reuse the existing lock-checking infrastructure.
 */
const createContext = async (
  config: CheckLockConfig,
): Promise<CloudflareProviderContext> => {
  const requestUrl = new URL(config.request.url)
  const keyName = APPWARDEN_CACHE_KEY
  const provider = "cloudflare-cache" as const

  const edgeCache = store.json<LockValueType>(
    {
      serviceOrigin: requestUrl.origin,
      cache: (await caches.open("appwarden:lock")) as unknown as Cache,
    },
    keyName,
  )

  return {
    keyName,
    request: config.request,
    edgeCache,
    requestUrl,
    provider,
    debug: config.debug ?? false,
    lockPageSlug: config.lockPageSlug,
    appwardenApiToken: config.appwardenApiToken,
    appwardenApiHostname: config.appwardenApiHostname,
    waitUntil: config.waitUntil,
  }
}

/**
 * Resolves the lock value and determines if the site is locked.
 * This is extracted from maybeQuarantine for reuse.
 */
const resolveLockStatus = async (
  context: CloudflareProviderContext,
): Promise<
  CheckLockResult & {
    lockValue: LockValueType | undefined
    wasDeleted: boolean
  }
> => {
  const { lockValue, shouldDeleteEdgeValue } = await getLockValue(context)

  if (shouldDeleteEdgeValue) {
    await deleteEdgeValue(context)
  }

  const isTestRoute = context.requestUrl.pathname === APPWARDEN_TEST_ROUTE
  const isTestLock =
    isTestRoute && !MemoryCache.isTestExpired(lockValue) && !!lockValue

  return {
    isLocked: !!lockValue?.isLocked || isTestLock,
    isTestLock,
    lockValue,
    wasDeleted: shouldDeleteEdgeValue ?? false,
  }
}

/**
 * Checks if the site is currently locked.
 *
 * This is a framework-agnostic function that can be used by any adapter
 * (React Router, Cloudflare Workers, etc.) to check the lock status.
 *
 * It handles:
 * - Reading from the edge cache
 * - Syncing with the Appwarden API when cache is expired
 * - Test route handling for temporary locks
 *
 * @param config - The configuration for checking lock status
 * @returns A promise that resolves to the lock status result
 */
export const checkLockStatus = async (
  config: CheckLockConfig,
): Promise<CheckLockResult> => {
  const context = await createContext(config)

  // Get current lock status and cached value in a single call
  let { isLocked, isTestLock, lockValue, wasDeleted } =
    await resolveLockStatus(context)

  // Sync the edge value if cache is expired or was deleted due to corruption
  if (MemoryCache.isExpired(lockValue) || wasDeleted) {
    if (!lockValue || wasDeleted || lockValue.isLocked) {
      // Sync synchronously if no cache, cache was corrupted/deleted, or currently locked
      // to avoid rendering incorrect lock state
      await syncEdgeValue(context)
      // Re-check after sync
      ;({ isLocked, isTestLock } = await resolveLockStatus(context))
    } else {
      // Sync asynchronously in background if cache exists and not locked
      config.waitUntil(syncEdgeValue(context))
    }
  }

  return { isLocked, isTestLock }
}

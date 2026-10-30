import { APPWARDEN_CACHE_KEY, APPWARDEN_TEST_ROUTE } from "../constants"
import { LockValueType } from "../schemas"
import { CloudflareProviderContext } from "../types"
import { debug, MemoryCache } from "../utils"
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
  lockPageSlug?: string
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

  const debugFn = debug(config.debug ?? false)

  const edgeCache = store.json<LockValueType>(
    {
      serviceOrigin: requestUrl.origin,
      cache: (await caches.open("appwarden:lock")) as unknown as Cache,
      debug: debugFn,
      waitUntil: config.waitUntil,
    },
    keyName,
  )

  return {
    keyName,
    request: config.request,
    edgeCache,
    requestUrl,
    provider,
    debug: debugFn,
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
    context.debug("Deleting corrupted cache value")
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
 * When a sync may next be attempted after one failed.
 *
 * A failed sync left nothing behind, so the next request re-fired it: with the API down,
 * every request on the site became an API call, and on a locked site every request also
 * blocked on the API's own 10 s timeout before it could serve. One deadline per isolate
 * bounds the attempts to the middleware's own pull cadence — a single window — and needs no
 * shared store, because `CACHE_EXPIRY_MS` already means exactly that everywhere else.
 *
 * Isolate-local is enough: the worst case is one attempt per window per isolate, which is
 * what a healthy site does anyway.
 */
let retryAfter = 0

/** How long a failed sync waits before the next attempt: one pull window. */
const retryBackoffMs = () => {
  // @ts-expect-error CACHE_EXPIRY_MS is injected at build time by tsup's `define`
  return CACHE_EXPIRY_MS as number
}

/**
 * Clears the retry deadline.
 *
 * The deadline is module state, so a test that drives a failure has to clear it before the
 * next case, or every later case in the file would skip its own sync.
 */
export const resetSyncRetryDeadline = (): void => {
  retryAfter = 0
}

/**
 * Runs a sync and records the backoff when it fails.
 *
 * A successful sync clears the deadline, so recovery is immediate once the API answers
 * again rather than waiting out a window that no longer applies.
 */
const syncAndRecordFailure = async (context: CloudflareProviderContext) => {
  const result = await syncEdgeValue(context)

  if (result.ok) {
    retryAfter = 0
    return
  }

  retryAfter = Date.now() + retryBackoffMs()
  context.debug(
    `Sync failed (${result.reason}) - not retrying for ${retryBackoffMs()}ms`,
  )
}

/**
 * The sync in flight per origin, so requests that arrive together share one pull rather than
 * each firing their own. Per isolate and best-effort: the hot path cannot afford a shared
 * store, and a fresh isolate still fires the first pull of its own. Keyed by origin because
 * one Worker serves many domains through `multidomainConfig`.
 */
const inFlightSyncs = new Map<string, Promise<void>>()

/** Runs one sync per origin at a time, joining the one already running. */
const syncOncePerOrigin = (
  context: CloudflareProviderContext,
): Promise<void> => {
  const key = context.requestUrl.origin

  const inFlight = inFlightSyncs.get(key)
  if (inFlight) {
    context.debug("Joining the sync already in flight for this origin")
    return inFlight
  }

  const promise = syncAndRecordFailure(context).finally(() => {
    // Only clear our own entry.
    if (inFlightSyncs.get(key) === promise) {
      inFlightSyncs.delete(key)
    }
  })

  inFlightSyncs.set(key, promise)
  return promise
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

  const isExpired = MemoryCache.isExpired(lockValue)

  // Log when we can confidently use a fresh cached value
  if (!isExpired && !wasDeleted && lockValue) {
    context.debug("Lock value resolved from cache")
  }

  // Sync the edge value if cache is expired or was deleted due to corruption, unless a
  // previous attempt failed and is still inside its backoff window. The last known value
  // keeps being served either way — the deadline only stops the retry, not the answer.
  if (isExpired || wasDeleted) {
    if (Date.now() < retryAfter) {
      context.debug(
        "Skipping sync - a previous attempt failed inside its backoff window",
      )
    } else if (!lockValue || wasDeleted || lockValue.isLocked) {
      // Sync synchronously if no cache, cache was corrupted/deleted, or currently locked
      // to avoid rendering incorrect lock state
      context.debug(
        "No fresh cached lock status available - syncing with API synchronously",
      )
      await syncOncePerOrigin(context)
      // Re-check after sync
      ;({ isLocked, isTestLock } = await resolveLockStatus(context))
    } else {
      // Sync asynchronously in background if cache exists and not locked
      context.debug(
        "Cached lock status expired but last known state unlocked - syncing with API in background",
      )
      config.waitUntil(syncOncePerOrigin(context))
    }
  }

  return { isLocked, isTestLock }
}

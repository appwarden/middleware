import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_TEST_ROUTE } from "../constants"
import { LockValueType } from "../schemas"
import { MemoryCache } from "../utils"
import {
  deleteEdgeValue,
  getLockValue,
  store,
  syncEdgeValue,
} from "../utils/cloudflare"
import {
  CheckLockConfig,
  checkLockStatus,
  resetSyncRetryDeadline,
} from "./check-lock-status"

// Mock dependencies
vi.mock("../utils/cloudflare", () => ({
  getLockValue: vi.fn(),
  deleteEdgeValue: vi.fn(),
  syncEdgeValue: vi.fn(),
  store: {
    json: vi.fn().mockReturnValue({
      getValue: vi.fn(),
      updateValue: vi.fn(),
      deleteValue: vi.fn(),
    }),
  },
}))

vi.mock("../utils", () => ({
  MemoryCache: {
    isExpired: vi.fn(),
    isTestExpired: vi.fn(),
  },
  debug: vi.fn(() => vi.fn()),
}))

// Mock global caches API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

vi.stubGlobal("caches", {
  open: vi.fn().mockResolvedValue(mockCache),
})

describe("checkLockStatus", () => {
  let mockConfig: CheckLockConfig
  let mockWaitUntil: ReturnType<typeof vi.fn>

  const createLockValue = (
    overrides: Partial<LockValueType> = {},
  ): LockValueType => ({
    isLocked: 0,
    isLockedTest: 0,
    lastCheck: Date.now(),
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // The retry deadline is module state, so it outlives a case unless it is cleared here.
    resetSyncRetryDeadline()
    // `vitest.setup.ts` stubs this; a case that shortens it for a retry has to be undone,
    // or the next case inherits the shortened window.
    vi.stubGlobal("CACHE_EXPIRY_MS", 2_000)
    // A sync succeeds unless a case says otherwise, so only the cases about failure record
    // a deadline.
    vi.mocked(syncEdgeValue).mockResolvedValue({ ok: true })

    mockWaitUntil = vi.fn()

    mockConfig = {
      request: new Request("https://example.com/page"),
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
      lockPageSlug: "/maintenance",
      waitUntil: mockWaitUntil as any,
    }

    // Default: cache exists, not expired, not locked
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: createLockValue(),
      shouldDeleteEdgeValue: false,
    })
    vi.mocked(MemoryCache.isExpired).mockReturnValue(false)
    vi.mocked(MemoryCache.isTestExpired).mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("cache hit scenarios", () => {
    it("should return not locked when cache exists and is not expired", async () => {
      const result = await checkLockStatus(mockConfig)

      expect(result).toEqual({ isLocked: false, isTestLock: false })
      expect(syncEdgeValue).not.toHaveBeenCalled()
      expect(mockWaitUntil).not.toHaveBeenCalled()
    })

    it("should return locked when cache indicates locked state", async () => {
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: createLockValue({ isLocked: 1 }),
        shouldDeleteEdgeValue: false,
      })

      const result = await checkLockStatus(mockConfig)

      expect(result).toEqual({ isLocked: true, isTestLock: false })
    })
  })

  describe("cache miss scenarios", () => {
    it("should sync synchronously when no cache exists", async () => {
      vi.mocked(getLockValue)
        .mockResolvedValueOnce({
          lockValue: undefined,
        })
        .mockResolvedValueOnce({
          lockValue: createLockValue(),
          shouldDeleteEdgeValue: false,
        })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

      const result = await checkLockStatus(mockConfig)

      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).not.toHaveBeenCalled()
      expect(result).toEqual({ isLocked: false, isTestLock: false })
    })
  })

  describe("cache expiry scenarios", () => {
    it("should sync synchronously when cache is expired and locked", async () => {
      vi.mocked(getLockValue)
        .mockResolvedValueOnce({
          lockValue: createLockValue({ isLocked: 1 }),
          shouldDeleteEdgeValue: false,
        })
        .mockResolvedValueOnce({
          lockValue: createLockValue({ isLocked: 0 }),
          shouldDeleteEdgeValue: false,
        })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

      const result = await checkLockStatus(mockConfig)

      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).not.toHaveBeenCalled()
      // After sync, should reflect new unlocked state
      expect(result).toEqual({ isLocked: false, isTestLock: false })
    })

    it("should sync in background when cache is expired but not locked", async () => {
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: createLockValue({ isLocked: 0 }),
        shouldDeleteEdgeValue: false,
      })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

      const result = await checkLockStatus(mockConfig)

      // syncEdgeValue is called, but passed to waitUntil for background execution
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
      // getLockValue should only be called once (no re-check after background sync)
      expect(getLockValue).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ isLocked: false, isTestLock: false })
    })
  })

  describe("cache corruption scenarios", () => {
    it("should sync synchronously when cache is corrupted and deleted", async () => {
      // First call returns corrupted value that will be deleted
      vi.mocked(getLockValue)
        .mockResolvedValueOnce({
          lockValue: createLockValue({ isLocked: 0 }),
          shouldDeleteEdgeValue: true, // Cache was corrupted
        })
        .mockResolvedValueOnce({
          lockValue: createLockValue({ isLocked: 0 }),
          shouldDeleteEdgeValue: false,
        })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(false)

      const result = await checkLockStatus(mockConfig)

      // Should delete the corrupted cache
      expect(deleteEdgeValue).toHaveBeenCalledTimes(1)
      // Should sync synchronously, not in background
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).not.toHaveBeenCalled()
      expect(result).toEqual({ isLocked: false, isTestLock: false })
    })

    it("should sync synchronously when cache is corrupted even if value appears unlocked", async () => {
      // This tests the specific edge case: corrupted cache with isLocked: 0
      // should still trigger synchronous sync (not background)
      vi.mocked(getLockValue)
        .mockResolvedValueOnce({
          lockValue: createLockValue({ isLocked: 0 }),
          shouldDeleteEdgeValue: true,
        })
        .mockResolvedValueOnce({
          lockValue: createLockValue({ isLocked: 1 }), // After sync, actually locked
          shouldDeleteEdgeValue: false,
        })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(false)

      const result = await checkLockStatus(mockConfig)

      expect(deleteEdgeValue).toHaveBeenCalledTimes(1)
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
      expect(mockWaitUntil).not.toHaveBeenCalled()
      // Should reflect the actual locked state after sync
      expect(result).toEqual({ isLocked: true, isTestLock: false })
    })
  })

  describe("test route scenarios", () => {
    it("should return test lock when on test route with valid test lock", async () => {
      mockConfig.request = new Request(
        `https://example.com${APPWARDEN_TEST_ROUTE}`,
      )
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: createLockValue({ isLockedTest: Date.now() }),
        shouldDeleteEdgeValue: false,
      })
      vi.mocked(MemoryCache.isTestExpired).mockReturnValue(false)

      const result = await checkLockStatus(mockConfig)

      expect(result).toEqual({ isLocked: true, isTestLock: true })
    })

    it("should not return test lock when test lock is expired", async () => {
      mockConfig.request = new Request(
        `https://example.com${APPWARDEN_TEST_ROUTE}`,
      )
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: createLockValue({ isLockedTest: Date.now() - 100000 }),
        shouldDeleteEdgeValue: false,
      })
      vi.mocked(MemoryCache.isTestExpired).mockReturnValue(true)

      const result = await checkLockStatus(mockConfig)

      expect(result).toEqual({ isLocked: false, isTestLock: false })
    })
  })

  describe("config options", () => {
    it("should pass debug flag to context", async () => {
      mockConfig.debug = true

      await checkLockStatus(mockConfig)

      // Verify store.json was called (context creation)
      expect(store.json).toHaveBeenCalled()
    })

    it("should pass custom API hostname to context", async () => {
      mockConfig.appwardenApiHostname = "https://custom-api.appwarden.io"

      await checkLockStatus(mockConfig)

      expect(store.json).toHaveBeenCalled()
    })
  })

  describe("sync failure backoff", () => {
    beforeEach(() => {
      // No cached value, so a sync takes the synchronous path, and the API keeps failing.
      vi.mocked(getLockValue).mockResolvedValue({ lockValue: undefined })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)
      vi.mocked(syncEdgeValue).mockResolvedValue({
        ok: false,
        reason:
          "GET https://api.appwarden.io failed: 500 Internal Server Error",
      })
    })

    it("should sync once across many requests while the API keeps failing", async () => {
      for (let i = 0; i < 5; i++) {
        await checkLockStatus(mockConfig)
      }

      // One attempt per window, not one per request. One per request is what turned every
      // request on a site into an API call, and on a locked site a 10 s wait on each.
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
    })

    it("should retry once the window has passed", async () => {
      vi.stubGlobal("CACHE_EXPIRY_MS", 1)

      await checkLockStatus(mockConfig)
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)

      await new Promise((resolve) => setTimeout(resolve, 10))

      await checkLockStatus(mockConfig)
      expect(syncEdgeValue).toHaveBeenCalledTimes(2)
    })

    it("should clear the deadline as soon as a sync succeeds", async () => {
      vi.stubGlobal("CACHE_EXPIRY_MS", 1)

      await checkLockStatus(mockConfig)
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)

      vi.mocked(syncEdgeValue).mockResolvedValue({ ok: true })
      await new Promise((resolve) => setTimeout(resolve, 10))
      await checkLockStatus(mockConfig)
      expect(syncEdgeValue).toHaveBeenCalledTimes(2)

      // No wait this time: the failure is behind us, so the deadline no longer applies.
      await checkLockStatus(mockConfig)
      expect(syncEdgeValue).toHaveBeenCalledTimes(3)
    })
  })

  describe("concurrent sync coalescing", () => {
    type SyncResult = Awaited<ReturnType<typeof syncEdgeValue>>

    /** A pull the case controls, so it can hold a sync open while other requests arrive. */
    const createDeferred = () => {
      let resolve!: (value: SyncResult) => void
      const promise = new Promise<SyncResult>((res) => {
        resolve = res
      })
      return { promise, resolve }
    }

    /** Lets every request reach the pull before the case asserts on how many were made. */
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

    beforeEach(() => {
      // No cached value, so a request takes the synchronous sync path.
      vi.mocked(getLockValue).mockResolvedValue({ lockValue: undefined })
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)
    })

    it("should run one sync for requests that arrive together", async () => {
      const pull = createDeferred()
      vi.mocked(syncEdgeValue).mockReturnValue(pull.promise)

      const requests = Array.from({ length: 5 }, () =>
        checkLockStatus(mockConfig),
      )
      await flush()

      // Five requests, one pull. Without this each one is its own API call, which is what
      // turns a burst of traffic on a cold cache into a burst of 429s.
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)

      pull.resolve({ ok: true })
      const results = await Promise.all(requests)

      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
      expect(results).toEqual([
        { isLocked: false, isTestLock: false },
        { isLocked: false, isTestLock: false },
        { isLocked: false, isTestLock: false },
        { isLocked: false, isTestLock: false },
        { isLocked: false, isTestLock: false },
      ])
    })

    it("should share a pull between a background sync and a synchronous one", async () => {
      const pull = createDeferred()
      vi.mocked(syncEdgeValue).mockReturnValue(pull.promise)

      // Expired but unlocked: the first request syncs in the background.
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: createLockValue({ isLocked: 0 }),
        shouldDeleteEdgeValue: false,
      })
      await checkLockStatus(mockConfig)

      expect(mockWaitUntil).toHaveBeenCalledTimes(1)
      expect(syncEdgeValue).toHaveBeenCalledTimes(1)

      // A second request arrives with no cache and waits on the same pull rather than
      // starting one of its own.
      vi.mocked(getLockValue).mockResolvedValue({ lockValue: undefined })
      const second = checkLockStatus(mockConfig)
      await flush()

      expect(syncEdgeValue).toHaveBeenCalledTimes(1)

      pull.resolve({ ok: true })
      await second

      expect(syncEdgeValue).toHaveBeenCalledTimes(1)
    })

    it("should start a new sync once the previous one has settled", async () => {
      await checkLockStatus(mockConfig)
      await checkLockStatus(mockConfig)

      // The entry is cleared on settle, so a later request is not held behind a pull that
      // already finished.
      expect(syncEdgeValue).toHaveBeenCalledTimes(2)
    })

    it("should not share a sync across origins", async () => {
      const pull = createDeferred()
      vi.mocked(syncEdgeValue).mockReturnValue(pull.promise)

      // One Worker serves many domains through `multidomainConfig`, so a single shared entry
      // would let one domain's pull stand in for another domain's cache.
      const first = checkLockStatus(mockConfig)
      const other = checkLockStatus({
        ...mockConfig,
        request: new Request("https://other.example.net/page"),
      })
      await flush()

      expect(syncEdgeValue).toHaveBeenCalledTimes(2)

      pull.resolve({ ok: true })
      await Promise.all([first, other])
    })
  })
})

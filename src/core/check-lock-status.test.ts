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
import { CheckLockConfig, checkLockStatus } from "./check-lock-status"

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
    code: "test-code",
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    mockWaitUntil = vi.fn()

    mockConfig = {
      request: new Request("https://example.com/page"),
      appwardenApiToken: "test-token",
      lockPageSlug: "/maintenance",
      waitUntil: mockWaitUntil,
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
          shouldDeleteEdgeValue: false,
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
})

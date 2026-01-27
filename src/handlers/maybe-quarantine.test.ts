import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_TEST_ROUTE } from "../constants"
import { CloudflareProviderContext } from "../types"
import { MemoryCache } from "../utils"
import {
  deleteEdgeValue,
  getLockValue,
  syncEdgeValue,
} from "../utils/cloudflare"
import { maybeQuarantine } from "./maybe-quarantine"

// Mock dependencies
vi.mock("../utils/cloudflare", () => ({
  getLockValue: vi.fn(),
  deleteEdgeValue: vi.fn(),
  syncEdgeValue: vi.fn(),
}))

vi.mock("../utils", () => ({
  MemoryCache: {
    isExpired: vi.fn(),
    isTestExpired: vi.fn(),
  },
}))

describe("maybeQuarantine", () => {
  let mockContext: CloudflareProviderContext
  let mockOptions: { onLocked: () => Promise<void> }
  let onLockedSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup test data
    onLockedSpy = vi.fn(() => {})
    mockOptions = {
      onLocked: vi.fn().mockImplementation(async () => {
        ;(onLockedSpy as any)()
      }),
    }

    mockContext = {
      request: new Request("https://example.com"),
      requestUrl: new URL("https://example.com"),
      keyName: "appwarden-lock",
      provider: "cloudflare-cache",
      edgeCache: {
        getValue: vi.fn(),
        updateValue: vi.fn(),
        deleteValue: vi.fn(),
      },
      waitUntil: vi.fn(),
    } as unknown as CloudflareProviderContext
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("resolveLockValue", () => {
    it("should delete edge value when shouldDeleteEdgeValue is true", async () => {
      // Mock getLockValue to return shouldDeleteEdgeValue: true
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 0,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: true,
      })

      await maybeQuarantine(mockContext, mockOptions)

      expect(deleteEdgeValue).toHaveBeenCalledWith(mockContext)
    })

    it("should call onLocked when lockValue.isLocked is true", async () => {
      // Mock getLockValue to return a locked value
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      await maybeQuarantine(mockContext, mockOptions)

      expect(mockOptions.onLocked).toHaveBeenCalled()
      expect(onLockedSpy).toHaveBeenCalled()
    })

    it("should call onLocked when request URL is test route and test lock is not expired", async () => {
      // Set request URL to test route
      mockContext.requestUrl = new URL(
        `https://example.com${APPWARDEN_TEST_ROUTE}`,
      )

      // Mock getLockValue to return a value with test lock
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 0,
          isLockedTest: Date.now(),
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Mock isTestExpired to return false (test lock not expired)
      vi.mocked(MemoryCache.isTestExpired).mockReturnValue(false)

      await maybeQuarantine(mockContext, mockOptions)

      expect(mockOptions.onLocked).toHaveBeenCalled()
      expect(onLockedSpy).toHaveBeenCalled()
    })

    it("should not call onLocked when none of the conditions are met", async () => {
      // Mock getLockValue to return an unlocked value
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 0,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Mock isTestExpired to return true (test lock expired)
      vi.mocked(MemoryCache.isTestExpired).mockReturnValue(true)

      await maybeQuarantine(mockContext, mockOptions)

      expect(mockOptions.onLocked).not.toHaveBeenCalled()
      expect(onLockedSpy).not.toHaveBeenCalled()
    })
  })

  describe("maybeQuarantine", () => {
    it("should sync edge value synchronously when cache is expired and there's no cached lock value", async () => {
      // First call to getLockValue returns undefined
      vi.mocked(getLockValue).mockResolvedValueOnce({
        lockValue: undefined,
      } as any)

      // Second call to getLockValue after syncEdgeValue
      vi.mocked(getLockValue).mockResolvedValueOnce({
        lockValue: {
          isLocked: 0,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Mock isExpired to return true (cache expired)
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

      await maybeQuarantine(mockContext, mockOptions)

      // Should sync edge value synchronously
      expect(syncEdgeValue).toHaveBeenCalledWith(mockContext)
      // Should call getLockValue again after syncing
      expect(getLockValue).toHaveBeenCalledTimes(2)
      // Should not use waitUntil
      expect(mockContext.waitUntil).not.toHaveBeenCalled()
    })

    it("should sync edge value synchronously when cache is expired and cached lock value is locked", async () => {
      // First call to getLockValue returns a locked value
      vi.mocked(getLockValue).mockResolvedValueOnce({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Second call to getLockValue after syncEdgeValue
      vi.mocked(getLockValue).mockResolvedValueOnce({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Mock isExpired to return true (cache expired)
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

      await maybeQuarantine(mockContext, mockOptions)

      // Should sync edge value synchronously
      expect(syncEdgeValue).toHaveBeenCalledWith(mockContext)
      // Should call getLockValue again after syncing
      expect(getLockValue).toHaveBeenCalledTimes(2)
      // Should not use waitUntil
      expect(mockContext.waitUntil).not.toHaveBeenCalled()
    })

    it("should sync edge value asynchronously when cache is expired but cached lock value is not locked", async () => {
      // Mock getLockValue to return an unlocked value
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 0,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Mock isExpired to return true (cache expired)
      vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

      // Create a mock for syncEdgeValue that we can capture the promise from
      const syncPromise = Promise.resolve()
      vi.mocked(syncEdgeValue).mockReturnValue(syncPromise)

      await maybeQuarantine(mockContext, mockOptions)

      // Should use waitUntil for asynchronous sync
      expect(mockContext.waitUntil).toHaveBeenCalledWith(syncPromise)
      // Should call getLockValue only once
      expect(getLockValue).toHaveBeenCalledTimes(1)
    })

    it("should not sync edge value when cache is not expired", async () => {
      // Mock getLockValue to return a value
      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 0,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Mock isExpired to return false (cache not expired)
      vi.mocked(MemoryCache.isExpired).mockReturnValue(false)

      await maybeQuarantine(mockContext, mockOptions)

      // Should not sync edge value
      expect(syncEdgeValue).not.toHaveBeenCalled()
      // Should not use waitUntil
      expect(mockContext.waitUntil).not.toHaveBeenCalled()
      // Should call getLockValue only once
      expect(getLockValue).toHaveBeenCalledTimes(1)
    })
  })
})

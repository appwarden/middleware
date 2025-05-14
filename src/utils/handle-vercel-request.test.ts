import { NextFetchEvent, NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY, APPWARDEN_TEST_ROUTE } from "../constants"
import { LockValueType } from "../schemas"
import { VercelProviderContext } from "../types"
import { handleVercelRequest } from "./handle-vercel-request"
import { MemoryCache } from "./memory-cache"
import { deleteEdgeValue, getLockValue } from "./vercel"

// Mock dependencies
vi.mock("./vercel", () => ({
  getLockValue: vi.fn(),
  deleteEdgeValue: vi.fn(),
}))

vi.mock("./memory-cache", () => {
  const originalModule = vi.importActual("./memory-cache")
  return {
    ...originalModule,
    MemoryCache: {
      isExpired: vi.fn(),
      isTestExpired: vi.fn(),
    },
  }
})

describe("handleVercelRequest", () => {
  let mockContext: VercelProviderContext
  let mockMemoryCache: MemoryCache<string, LockValueType>
  let mockOnLocked: () => void

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create mock memory cache
    mockMemoryCache = {
      get: vi.fn(),
      put: vi.fn(),
      getValues: vi.fn(),
    } as unknown as MemoryCache<string, LockValueType>

    // Create mock context
    mockContext = {
      req: {} as NextRequest,
      requestUrl: new URL("https://example.com"),
      keyName: APPWARDEN_CACHE_KEY,
      event: {} as NextFetchEvent,
      provider: "edge-config",
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "test-token",
      vercelApiToken: "vercel-token",
      lockPageSlug: "/maintenance",
      memoryCache: mockMemoryCache,
      waitUntil: vi.fn(),
    }

    // Create mock onLocked callback
    mockOnLocked = vi.fn()

    // Default mock for MemoryCache.isExpired
    vi.mocked(MemoryCache.isExpired).mockReturnValue(false)

    // Default mock for MemoryCache.isTestExpired
    vi.mocked(MemoryCache.isTestExpired).mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should return cached value when cache is not expired", async () => {
    // Mock cached value
    const mockCachedValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(mockCachedValue)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(false)

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBe(mockCachedValue)
    expect(mockMemoryCache.get).toHaveBeenCalledWith(APPWARDEN_CACHE_KEY)
    expect(MemoryCache.isExpired).toHaveBeenCalledWith(mockCachedValue)
    expect(getLockValue).not.toHaveBeenCalled()
    expect(mockMemoryCache.put).not.toHaveBeenCalled()
    expect(deleteEdgeValue).not.toHaveBeenCalled()
    expect(mockOnLocked).not.toHaveBeenCalled()
  })

  it("should fetch new value when cache is expired", async () => {
    // Mock cached value
    const mockCachedValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now() - 60000, // 1 minute ago
      code: "old-code",
    }

    // Mock new value from edge
    const mockNewValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "new-code",
    }

    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(mockCachedValue)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(true)
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: mockNewValue,
      shouldDeleteEdgeValue: false,
    })

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBe(mockNewValue)
    expect(mockMemoryCache.get).toHaveBeenCalledWith(APPWARDEN_CACHE_KEY)
    expect(MemoryCache.isExpired).toHaveBeenCalledWith(mockCachedValue)
    expect(getLockValue).toHaveBeenCalledWith(mockContext)
    expect(mockMemoryCache.put).toHaveBeenCalledWith(
      APPWARDEN_CACHE_KEY,
      mockNewValue,
    )
    expect(deleteEdgeValue).not.toHaveBeenCalled()
    expect(mockOnLocked).not.toHaveBeenCalled()
  })

  it("should call onLocked when site is locked", async () => {
    // Mock cached value with isLocked = 1
    const mockCachedValue: LockValueType = {
      isLocked: 1,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(mockCachedValue)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(false)

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBe(mockCachedValue)
    expect(mockOnLocked).toHaveBeenCalled()
  })

  it("should call onLocked when on test route and test is not expired", async () => {
    // Mock cached value
    const mockCachedValue: LockValueType = {
      isLocked: 0,
      isLockedTest: Date.now(), // Just set
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(mockCachedValue)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(false)
    vi.mocked(MemoryCache.isTestExpired).mockReturnValue(false)

    // Set request URL to test route
    mockContext.requestUrl = new URL(
      `https://example.com${APPWARDEN_TEST_ROUTE}`,
    )

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBe(mockCachedValue)
    expect(mockOnLocked).toHaveBeenCalled()
  })

  it("should delete edge value when shouldDeleteEdgeValue is true", async () => {
    // Mock cached value
    const mockCachedValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now() - 60000, // 1 minute ago
      code: "old-code",
    }

    // Mock new value from edge
    const mockNewValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "new-code",
    }

    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(mockCachedValue)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(true)
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: mockNewValue,
      shouldDeleteEdgeValue: true,
    })

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBe(mockNewValue)
    expect(deleteEdgeValue).toHaveBeenCalledWith(mockContext)
  })

  it("should handle undefined lockValue from getLockValue", async () => {
    // Mock cached value
    const mockCachedValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now() - 60000, // 1 minute ago
      code: "old-code",
    }

    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(mockCachedValue)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(true)
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: undefined,
      shouldDeleteEdgeValue: undefined,
    })

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBeUndefined()
    expect(mockMemoryCache.put).not.toHaveBeenCalled()
  })

  it("should handle no cached value", async () => {
    // Setup mocks
    vi.mocked(mockMemoryCache.get).mockReturnValue(undefined)
    vi.mocked(MemoryCache.isExpired).mockReturnValue(true)

    // Mock new value from edge
    const mockNewValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "new-code",
    }

    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: mockNewValue,
      shouldDeleteEdgeValue: false,
    })

    // Call the function
    const result = await handleVercelRequest(mockContext, {
      onLocked: mockOnLocked,
    })

    // Verify results
    expect(result).toBe(mockNewValue)
    expect(mockMemoryCache.put).toHaveBeenCalledWith(
      APPWARDEN_CACHE_KEY,
      mockNewValue,
    )
  })
})

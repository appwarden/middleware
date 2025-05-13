import { describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { LockValueType } from "../schemas"
import { JSONStore, getLockValue } from "../utils/cloudflare"
import { handleResetCache, isResetCacheRequest } from "./reset-cache"

// Mock dependencies
vi.mock("../utils/cloudflare", () => ({
  getLockValue: vi.fn(),
}))

describe("isResetCacheRequest", () => {
  it("should return true for valid reset cache requests", () => {
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })

    expect(isResetCacheRequest(request)).toBe(true)
  })

  it("should return false for non-POST requests", () => {
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
    })

    expect(isResetCacheRequest(request)).toBe(false)
  })

  it("should return false for different paths", () => {
    const request = new Request("https://example.com/other-path", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    })

    expect(isResetCacheRequest(request)).toBe(false)
  })

  it("should return false for non-JSON content type", () => {
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
    })

    expect(isResetCacheRequest(request)).toBe(false)
  })
})

describe("handleResetCache", () => {
  it("should delete cache when code matches", async () => {
    // Mock lock value
    const mockLockValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Mock edge cache
    const mockEdgeCache = {
      deleteValue: vi.fn().mockResolvedValue(undefined),
    } as unknown as JSONStore<LockValueType>

    // Mock getLockValue
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: mockLockValue,
      shouldDeleteEdgeValue: false,
    })

    // Create request with matching code
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "test-code" }),
    })

    // Call the function
    await handleResetCache(
      APPWARDEN_CACHE_KEY,
      "cloudflare-cache",
      mockEdgeCache,
      request,
    )

    // Verify results
    expect(getLockValue).toHaveBeenCalledWith({
      keyName: APPWARDEN_CACHE_KEY,
      provider: "cloudflare-cache",
      edgeCache: mockEdgeCache,
    })
    expect(mockEdgeCache.deleteValue).toHaveBeenCalled()
  })

  it("should not delete cache when code doesn't match", async () => {
    // Mock lock value
    const mockLockValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Mock edge cache
    const mockEdgeCache = {
      deleteValue: vi.fn().mockResolvedValue(undefined),
    } as unknown as JSONStore<LockValueType>

    // Mock getLockValue
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: mockLockValue,
      shouldDeleteEdgeValue: false,
    })

    // Create request with non-matching code
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "wrong-code" }),
    })

    // Call the function
    await handleResetCache(
      APPWARDEN_CACHE_KEY,
      "cloudflare-cache",
      mockEdgeCache,
      request,
    )

    // Verify results
    expect(mockEdgeCache.deleteValue).not.toHaveBeenCalled()
  })

  it("should handle JSON parsing errors", async () => {
    // Mock lock value
    const mockLockValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Mock edge cache
    const mockEdgeCache = {
      deleteValue: vi.fn().mockResolvedValue(undefined),
    } as unknown as JSONStore<LockValueType>

    // Mock getLockValue
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: mockLockValue,
      shouldDeleteEdgeValue: false,
    })

    // Create request with invalid JSON
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "invalid-json",
    })

    // Call the function
    await handleResetCache(
      APPWARDEN_CACHE_KEY,
      "cloudflare-cache",
      mockEdgeCache,
      request,
    )

    // Verify results
    expect(mockEdgeCache.deleteValue).not.toHaveBeenCalled()
  })
})

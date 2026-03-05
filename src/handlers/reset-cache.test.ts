import { describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { LockValueType } from "../schemas"
import { JSONStore } from "../utils/cloudflare"
import { handleResetCache, isResetCacheRequest } from "./reset-cache"

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
  it("should delete cache for a valid reset cache request", async () => {
    // Mock edge cache
    const mockEdgeCache = {
      deleteValue: vi.fn().mockResolvedValue(undefined),
    } as unknown as JSONStore<LockValueType>

    // Create request with JSON body (contents are ignored by handler)
    const request = new Request("https://example.com/__appwarden/reset-cache", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ any: "payload" }),
    })

    // Call the function
    await handleResetCache(
      APPWARDEN_CACHE_KEY,
      "cloudflare-cache",
      mockEdgeCache,
      request,
    )

    // Verify results
    expect(mockEdgeCache.deleteValue).toHaveBeenCalled()
  })

  it("should delete cache even when request body is invalid JSON", async () => {
    // Mock edge cache
    const mockEdgeCache = {
      deleteValue: vi.fn().mockResolvedValue(undefined),
    } as unknown as JSONStore<LockValueType>

    // Create request with invalid JSON body. The handler no longer parses the
    // body, so this should still succeed and delete the cache.
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
    expect(mockEdgeCache.deleteValue).toHaveBeenCalled()
  })
})

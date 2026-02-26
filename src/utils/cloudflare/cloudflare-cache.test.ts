import { Cache } from "@cloudflare/workers-types"
import { describe, expect, it, vi } from "vitest"
import { store } from "./cloudflare-cache"

describe("cloudflare-cache", () => {
  // Create mock cache
  const createMockCache = () => {
    return {
      match: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as Cache
  }

  // Create mock context
  const createMockContext = (cache: Cache) => ({
    cache,
    serviceOrigin: "https://example.com",
    debug: vi.fn(),
  })

  describe("store.json", () => {
    it("should create a JSONStore with the correct methods", () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      const jsonStore = store.json(mockContext, "/test-key")

      expect(jsonStore).toHaveProperty("getValue")
      expect(jsonStore).toHaveProperty("updateValue")
      expect(jsonStore).toHaveProperty("deleteValue")
      expect(typeof jsonStore.getValue).toBe("function")
      expect(typeof jsonStore.updateValue).toBe("function")
      expect(typeof jsonStore.deleteValue).toBe("function")
    })

    it("should use the correct cache key URL", () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      const jsonStore = store.json(mockContext, "/test-key")

      // Call methods to trigger internal functions
      jsonStore.getValue()

      // Verify cache.match was called with the correct URL
      expect(mockCache.match).toHaveBeenCalledWith(
        new URL("/test-key", "https://example.com"),
      )
    })
  })

  describe("getValue", () => {
    it("should return the cached value when it exists", async () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      // Mock a cache hit
      const mockResponse = new Response(JSON.stringify({ test: "data" }))
      vi.mocked(mockCache.match).mockResolvedValue(mockResponse)

      const jsonStore = store.json(mockContext, "/test-key")
      const result = await jsonStore.getValue()

      expect(result).toBe(mockResponse)
      expect(mockContext.debug).not.toHaveBeenCalled()
    })

    it("should return undefined when the cache is empty", async () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      // Mock a cache miss
      vi.mocked(mockCache.match).mockResolvedValue(undefined)

      const jsonStore = store.json(mockContext, "/test-key")
      const result = await jsonStore.getValue()

      expect(result).toBeUndefined()
      expect(mockContext.debug).not.toHaveBeenCalled()
    })
  })

  describe("updateValue", () => {
    it("should update the cache with the provided value", async () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      const jsonStore = store.json(mockContext, "/test-key")
      const testData = { test: "data" }

      await jsonStore.updateValue(testData)

      // Verify cache.put was called with the correct arguments
      expect(mockCache.put).toHaveBeenCalledWith(
        new URL("/test-key", "https://example.com"),
        expect.any(Response),
      )

      // Verify the response body contains the correct data
      const putCall = vi.mocked(mockCache.put).mock.calls[0]
      const response = putCall[1] as Response
      const responseBody = await response.json()

      expect(responseBody).toEqual(testData)
      expect(response.headers.get("content-type")).toBe("application/json")
    })

    it("should set cache-control header when ttl is provided", async () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      const jsonStore = store.json(mockContext, "/test-key", { ttl: 60 })
      const testData = { test: "data" }

      await jsonStore.updateValue(testData)

      // Verify the response has the correct cache-control header
      const putCall = vi.mocked(mockCache.put).mock.calls[0]
      const response = putCall[1] as Response

      expect(response.headers.get("cache-control")).toBe("max-age=60")
    })
  })

  describe("deleteValue", () => {
    it("should delete the cache entry", async () => {
      const mockCache = createMockCache()
      const mockContext = createMockContext(mockCache)

      // Mock successful deletion
      vi.mocked(mockCache.delete).mockResolvedValue(true)

      const jsonStore = store.json(mockContext, "/test-key")
      const result = await jsonStore.deleteValue()

      expect(result).toBe(true)
      expect(mockCache.delete).toHaveBeenCalledWith(
        new URL("/test-key", "https://example.com"),
      )
    })
  })
})

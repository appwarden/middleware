/**
 * Unit tests for the Mock Cache API
 */

import { beforeEach, describe, expect, it } from "vitest"
import { MockCache, MockCacheStorage } from "./cloudflare-cache-mock"

describe("MockCache", () => {
  let cache: MockCache

  beforeEach(() => {
    cache = new MockCache()
  })

  describe("put and match", () => {
    it("should store and retrieve a response", async () => {
      const request = new Request("https://example.com/test")
      const response = new Response("test data", {
        headers: { "content-type": "text/plain" },
      })

      await cache.put(request, response)
      const matched = await cache.match(request)

      expect(matched).toBeDefined()
      expect(await matched!.text()).toBe("test data")
    })

    it("should return undefined for non-existent keys", async () => {
      const request = new Request("https://example.com/nonexistent")
      const matched = await cache.match(request)

      expect(matched).toBeUndefined()
    })

    it("should handle URL strings as keys", async () => {
      const url = "https://example.com/test"
      const response = new Response("test data")

      await cache.put(url, response)
      const matched = await cache.match(url)

      expect(matched).toBeDefined()
      expect(await matched!.text()).toBe("test data")
    })

    it("should allow reading the same response multiple times", async () => {
      const request = new Request("https://example.com/test")
      const response = new Response(JSON.stringify({ test: "value" }), {
        headers: { "content-type": "application/json" },
      })

      await cache.put(request, response)

      // Read the response multiple times
      const matched1 = await cache.match(request)
      const matched2 = await cache.match(request)

      expect(await matched1!.json()).toEqual({ test: "value" })
      expect(await matched2!.json()).toEqual({ test: "value" })
    })
  })

  describe("TTL and expiration", () => {
    it("should respect max-age from Cache-Control header", async () => {
      const request = new Request("https://example.com/test")
      const response = new Response("test data", {
        headers: {
          "cache-control": "max-age=1", // 1 second
        },
      })

      await cache.put(request, response)

      // Should be available immediately
      const matched1 = await cache.match(request)
      expect(matched1).toBeDefined()

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Should be expired
      const matched2 = await cache.match(request)
      expect(matched2).toBeUndefined()
    })

    it("should not expire responses without Cache-Control", async () => {
      const request = new Request("https://example.com/test")
      const response = new Response("test data")

      await cache.put(request, response)

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should still be available
      const matched = await cache.match(request)
      expect(matched).toBeDefined()
    })

    it("should parse max-age correctly from complex Cache-Control headers", async () => {
      const request = new Request("https://example.com/test")
      const response = new Response("test data", {
        headers: {
          "cache-control": "public, max-age=2, must-revalidate",
        },
      })

      await cache.put(request, response)

      // Should be available immediately
      const matched1 = await cache.match(request)
      expect(matched1).toBeDefined()

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2100))

      // Should be expired
      const matched2 = await cache.match(request)
      expect(matched2).toBeUndefined()
    })
  })

  describe("delete", () => {
    it("should delete an existing entry", async () => {
      const request = new Request("https://example.com/test")
      const response = new Response("test data")

      await cache.put(request, response)
      const deleted = await cache.delete(request)

      expect(deleted).toBe(true)
      expect(await cache.match(request)).toBeUndefined()
    })

    it("should return false when deleting non-existent entry", async () => {
      const request = new Request("https://example.com/nonexistent")
      const deleted = await cache.delete(request)

      expect(deleted).toBe(false)
    })
  })

  describe("utility methods", () => {
    it("should clear all entries", async () => {
      await cache.put("https://example.com/1", new Response("data1"))
      await cache.put("https://example.com/2", new Response("data2"))

      expect(cache.size()).toBe(2)

      cache.clear()

      expect(cache.size()).toBe(0)
      expect(await cache.match("https://example.com/1")).toBeUndefined()
    })

    it("should report correct size", async () => {
      expect(cache.size()).toBe(0)

      await cache.put("https://example.com/1", new Response("data1"))
      expect(cache.size()).toBe(1)

      await cache.put("https://example.com/2", new Response("data2"))
      expect(cache.size()).toBe(2)
    })
  })
})

describe("MockCacheStorage", () => {
  let cacheStorage: MockCacheStorage

  beforeEach(() => {
    cacheStorage = new MockCacheStorage()
  })

  it("should create and retrieve named caches", async () => {
    const cache1 = await cacheStorage.open("cache1")
    const cache2 = await cacheStorage.open("cache2")

    expect(cache1).toBeDefined()
    expect(cache2).toBeDefined()
    expect(cache1).not.toBe(cache2)
  })

  it("should return the same cache instance for the same name", async () => {
    const cache1 = await cacheStorage.open("test")
    const cache2 = await cacheStorage.open("test")

    expect(cache1).toBe(cache2)
  })

  it("should provide a default cache", () => {
    const defaultCache = cacheStorage.default

    expect(defaultCache).toBeDefined()
    expect(defaultCache).toBeInstanceOf(MockCache)
  })

  describe("Named cache operations", () => {
    it("should store and retrieve data from a named cache", async () => {
      const cache = await cacheStorage.open("appwarden:lock")
      const request = new Request("https://example.com/test")
      const response = new Response(JSON.stringify({ isLocked: 0 }), {
        headers: { "content-type": "application/json" },
      })

      await cache.put(request, response)
      const matched = await cache.match(request)

      expect(matched).toBeDefined()
      expect(await matched!.json()).toEqual({ isLocked: 0 })
    })

    it("should isolate data between different named caches", async () => {
      const cache1 = await cacheStorage.open("cache1")
      const cache2 = await cacheStorage.open("cache2")

      const request = new Request("https://example.com/test")
      const response1 = new Response("data from cache1")
      const response2 = new Response("data from cache2")

      // Put different data in each cache
      await cache1.put(request, response1)
      await cache2.put(request, response2)

      // Verify each cache has its own data
      const matched1 = await cache1.match(request)
      const matched2 = await cache2.match(request)

      expect(await matched1!.text()).toBe("data from cache1")
      expect(await matched2!.text()).toBe("data from cache2")
    })

    it("should not share data between named cache and default cache", async () => {
      const namedCache = await cacheStorage.open("appwarden:lock")
      const defaultCache = cacheStorage.default

      const request = new Request("https://example.com/test")
      const namedResponse = new Response("named cache data")

      // Put data in named cache
      await namedCache.put(request, namedResponse)

      // Default cache should not have this data
      const matchedInDefault = await defaultCache.match(request)
      expect(matchedInDefault).toBeUndefined()

      // Named cache should have the data
      const matchedInNamed = await namedCache.match(request)
      expect(await matchedInNamed!.text()).toBe("named cache data")
    })

    it("should delete entries from a specific named cache without affecting others", async () => {
      const cache1 = await cacheStorage.open("cache1")
      const cache2 = await cacheStorage.open("cache2")

      const request = new Request("https://example.com/test")
      await cache1.put(request, new Response("data1"))
      await cache2.put(request, new Response("data2"))

      // Delete from cache1
      const deleted = await cache1.delete(request)
      expect(deleted).toBe(true)

      // cache1 should not have the data
      expect(await cache1.match(request)).toBeUndefined()

      // cache2 should still have its data
      const matched2 = await cache2.match(request)
      expect(await matched2!.text()).toBe("data2")
    })

    it("should handle TTL independently in different named caches", async () => {
      const cache1 = await cacheStorage.open("cache1")
      const cache2 = await cacheStorage.open("cache2")

      const request = new Request("https://example.com/test")
      const shortTTL = new Response("short", {
        headers: { "cache-control": "max-age=1" },
      })
      const longTTL = new Response("long", {
        headers: { "cache-control": "max-age=10" },
      })

      await cache1.put(request, shortTTL)
      await cache2.put(request, longTTL)

      // Wait for cache1 to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // cache1 should be expired
      expect(await cache1.match(request)).toBeUndefined()

      // cache2 should still be valid
      const matched2 = await cache2.match(request)
      expect(await matched2!.text()).toBe("long")
    })
  })

  describe("CacheStorage methods", () => {
    it("should delete a named cache", async () => {
      const cache = await cacheStorage.open("test-cache")
      const request = new Request("https://example.com/test")
      await cache.put(request, new Response("data"))

      const deleted = await cacheStorage.delete("test-cache")
      expect(deleted).toBe(true)

      // Opening the cache again should give a new empty cache
      const newCache = await cacheStorage.open("test-cache")
      expect(await newCache.match(request)).toBeUndefined()
    })

    it("should return false when deleting non-existent cache", async () => {
      const deleted = await cacheStorage.delete("non-existent")
      expect(deleted).toBe(false)
    })

    it("should check if a cache exists", async () => {
      expect(await cacheStorage.has("test-cache")).toBe(false)

      await cacheStorage.open("test-cache")
      expect(await cacheStorage.has("test-cache")).toBe(true)
    })

    it("should list all cache names", async () => {
      await cacheStorage.open("cache1")
      await cacheStorage.open("cache2")
      await cacheStorage.open("appwarden:lock")

      const keys = await cacheStorage.keys()
      expect(keys).toContain("cache1")
      expect(keys).toContain("cache2")
      expect(keys).toContain("appwarden:lock")
      expect(keys.length).toBeGreaterThanOrEqual(3)
    })

    it("should match across all caches", async () => {
      const cache1 = await cacheStorage.open("cache1")
      const cache2 = await cacheStorage.open("cache2")

      const request1 = new Request("https://example.com/test1")
      const request2 = new Request("https://example.com/test2")

      await cache1.put(request1, new Response("data1"))
      await cache2.put(request2, new Response("data2"))

      // Should find data from cache1
      const matched1 = await cacheStorage.match(request1)
      expect(await matched1!.text()).toBe("data1")

      // Should find data from cache2
      const matched2 = await cacheStorage.match(request2)
      expect(await matched2!.text()).toBe("data2")
    })

    it("should return undefined when no cache has the requested data", async () => {
      await cacheStorage.open("cache1")
      await cacheStorage.open("cache2")

      const request = new Request("https://example.com/nonexistent")
      const matched = await cacheStorage.match(request)

      expect(matched).toBeUndefined()
    })

    it("should clear all caches", async () => {
      const cache1 = await cacheStorage.open("cache1")
      const cache2 = await cacheStorage.open("cache2")

      await cache1.put("https://example.com/1", new Response("data1"))
      await cache2.put("https://example.com/2", new Response("data2"))

      cacheStorage.clearAll()

      // All caches should be removed
      expect(await cacheStorage.has("cache1")).toBe(false)
      expect(await cacheStorage.has("cache2")).toBe(false)
    })
  })
})

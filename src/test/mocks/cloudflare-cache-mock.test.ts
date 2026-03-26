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
})

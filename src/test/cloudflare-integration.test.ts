/**
 * Cloudflare Workers Cache Integration Tests
 *
 * These tests run in the real Workers runtime using @cloudflare/vitest-pool-workers.
 * They verify the full cache lifecycle including Stale-While-Revalidate (SWR) behavior.
 *
 * NOTE: Due to known issues with the Cloudflare Cache API in local testing environments
 * (see https://github.com/cloudflare/workers-sdk/issues/7481), we use a high-fidelity
 * mock implementation that simulates the Cache API behavior including TTL and expiration.
 *
 * Test Flow:
 * 1. Cold Miss: No cache → fetch from API → cache result
 * 2. Fresh Hit: Cache exists and not expired → serve from cache
 * 3. Stale Hit: Cache expired → serve stale + background refresh
 * 4. Updated Hit: After background refresh → serve fresh updated value
 */

import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { checkLockStatus } from "../core"
import { LockValueType } from "../schemas"
import { MockCacheStorage } from "./mocks/cloudflare-cache-mock"

// Create a mock cache storage instance to replace the broken native cache
const mockCacheStorage = new MockCacheStorage()

// Store mock responses for fetch
const mockResponses = new Map<string, Response>()

describe("Cloudflare Cache Integration (Real Workers Runtime)", () => {
  beforeAll(() => {
    // Replace the global caches object with our mock
    vi.stubGlobal("caches", mockCacheStorage)
  })

  afterAll(() => {
    // Restore the original global caches object to avoid cross-test pollution
    vi.unstubAllGlobals()
  })

  beforeEach(async () => {
    // Clear the mock cache between tests
    mockCacheStorage.clearAll()

    // Clear mock responses
    mockResponses.clear()

    // Mock fetch to intercept outbound requests
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const url = new URL(request.url)
      const key = `${request.method}:${url.origin}${url.pathname}`

      const mockResponse = mockResponses.get(key)
      if (mockResponse) {
        return mockResponse.clone()
      }

      throw new Error(`No mock found for ${key}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("Minimal cache test: verify mock cache.put and cache.match work", async () => {
    const testUrl = new Request("https://example.com/test-cache-key")
    const testResponse = new Response(JSON.stringify({ test: "value" }), {
      headers: { "content-type": "application/json" },
    })

    // Put into cache directly (no waitUntil)
    const cache = await mockCacheStorage.open("appwarden:lock")
    await cache.put(testUrl, testResponse)

    // Try to match
    const matched = await cache.match(testUrl)
    expect(matched).toBeDefined()
    expect(await matched!.json()).toEqual({ test: "value" })
  })

  it("Cold Miss: should fetch from API when cache is empty", async () => {
    const mockApiResponse: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
    }

    // Mock the Appwarden API response
    mockResponses.set(
      "POST:https://staging-api.appwarden.io/v1/appwarden/status",
      new Response(JSON.stringify({ content: mockApiResponse }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    // Create execution context to track background tasks
    const ctx = createExecutionContext()

    const result = await checkLockStatus({
      request: new Request("https://example.com/page"),
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://staging-api.appwarden.io",
      lockPageSlug: "/maintenance",
      waitUntil: ctx.waitUntil.bind(ctx),
    })

    // Wait for background cache operations to complete
    await waitOnExecutionContext(ctx)

    // Should not be locked
    expect(result.isLocked).toBe(false)

    // Verify cache was populated
    const cacheKeyUrl = new URL(APPWARDEN_CACHE_KEY, "https://example.com")
    const cacheKeyRequest = new Request(cacheKeyUrl)
    const cache = await mockCacheStorage.open("appwarden:lock")
    const cachedResponse = await cache.match(cacheKeyRequest)
    expect(cachedResponse).toBeDefined()

    const cachedValue = await cachedResponse!.json<LockValueType>()
    expect(cachedValue.isLocked).toBe(0)
    expect(cachedValue.lastCheck).toBeDefined()
  })

  it("Fresh Hit: should serve from cache when not expired", async () => {
    const waitUntilPromises: Promise<unknown>[] = []

    // Pre-populate cache with fresh value
    const cacheKeyUrl = new URL(APPWARDEN_CACHE_KEY, "https://example.com")
    const cacheKeyRequest = new Request(cacheKeyUrl)
    const freshValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
    }

    const cache = await mockCacheStorage.open("appwarden:lock")
    await cache.put(
      cacheKeyRequest,
      new Response(JSON.stringify(freshValue), {
        headers: { "content-type": "application/json" },
      }),
    )

    const result = await checkLockStatus({
      request: new Request("https://example.com/page"),
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://staging-api.appwarden.io",
      lockPageSlug: "/maintenance",
      waitUntil: (promise) => {
        waitUntilPromises.push(promise)
      },
    })

    // Should not be locked
    expect(result.isLocked).toBe(false)

    // Should NOT have scheduled background refresh
    expect(waitUntilPromises).toHaveLength(0)
  })

  it("Stale Hit + Background Refresh: should serve stale and refresh in background", async () => {
    const waitUntilPromises: Promise<unknown>[] = []

    // Pre-populate cache with stale value (older than CACHE_EXPIRY_MS)
    const cache = await mockCacheStorage.open("appwarden:lock")
    const cacheKeyUrl = new URL(APPWARDEN_CACHE_KEY, "https://example.com")
    const cacheKeyRequest = new Request(cacheKeyUrl)
    const staleValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now() - 3000, // 3 seconds ago (stale, since CACHE_EXPIRY_MS = 2000)
    }

    await cache.put(
      cacheKeyRequest,
      new Response(JSON.stringify(staleValue), {
        headers: { "content-type": "application/json" },
      }),
    )

    const updatedApiResponse: LockValueType = {
      isLocked: 1, // Now locked!
      isLockedTest: 0,
      lastCheck: Date.now(),
    }

    // Mock the Appwarden API response for background refresh
    mockResponses.set(
      "POST:https://staging-api.appwarden.io/v1/appwarden/status",
      new Response(JSON.stringify({ content: updatedApiResponse }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    const result = await checkLockStatus({
      request: new Request("https://example.com/page"),
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://staging-api.appwarden.io",
      lockPageSlug: "/maintenance",
      waitUntil: (promise) => {
        waitUntilPromises.push(promise)
      },
    })

    // Should serve stale value (not locked)
    expect(result.isLocked).toBe(false)

    // Should have scheduled background refresh
    expect(waitUntilPromises).toHaveLength(1)

    // Wait for background refresh to complete
    await Promise.all(waitUntilPromises)

    // Verify cache was updated with new value
    const updatedCachedResponse = await cache.match(cacheKeyRequest)
    const updatedCachedValue =
      await updatedCachedResponse!.json<LockValueType>()
    expect(updatedCachedValue.isLocked).toBe(1)
  })

  it("Updated Hit: should serve fresh updated value after background refresh", async () => {
    const waitUntilPromises: Promise<unknown>[] = []

    // Pre-populate cache with fresh locked value (simulating post-refresh state)
    const cache = await mockCacheStorage.open("appwarden:lock")
    const cacheKeyUrl = new URL(APPWARDEN_CACHE_KEY, "https://example.com")
    const cacheKeyRequest = new Request(cacheKeyUrl)
    const lockedValue: LockValueType = {
      isLocked: 1,
      isLockedTest: 0,
      lastCheck: Date.now(),
    }

    await cache.put(
      cacheKeyRequest,
      new Response(JSON.stringify(lockedValue), {
        headers: { "content-type": "application/json" },
      }),
    )

    const result = await checkLockStatus({
      request: new Request("https://example.com/page"),
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://staging-api.appwarden.io",
      lockPageSlug: "/maintenance",
      waitUntil: (promise) => {
        waitUntilPromises.push(promise)
      },
    })

    // Should now be locked (serving updated value)
    expect(result.isLocked).toBe(true)

    // Should NOT have scheduled background refresh
    expect(waitUntilPromises).toHaveLength(0)
  })

  it("Stale Locked: should refresh synchronously when stale value is locked", async () => {
    const waitUntilPromises: Promise<unknown>[] = []

    // Pre-populate cache with stale LOCKED value
    const cache = await mockCacheStorage.open("appwarden:lock")
    const cacheKeyUrl = new URL(APPWARDEN_CACHE_KEY, "https://example.com")
    const cacheKeyRequest = new Request(cacheKeyUrl)
    const staleLockedValue: LockValueType = {
      isLocked: 1,
      isLockedTest: 0,
      lastCheck: Date.now() - 3000, // Stale
    }

    await cache.put(
      cacheKeyRequest,
      new Response(JSON.stringify(staleLockedValue), {
        headers: { "content-type": "application/json" },
      }),
    )

    const updatedApiResponse: LockValueType = {
      isLocked: 0, // Now unlocked!
      isLockedTest: 0,
      lastCheck: Date.now(),
    }

    // Mock the Appwarden API response for synchronous refresh
    mockResponses.set(
      "POST:https://staging-api.appwarden.io/v1/appwarden/status",
      new Response(JSON.stringify({ content: updatedApiResponse }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    const result = await checkLockStatus({
      request: new Request("https://example.com/page"),
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://staging-api.appwarden.io",
      lockPageSlug: "/maintenance",
      waitUntil: (promise) => {
        waitUntilPromises.push(promise)
      },
    })

    // Should refresh synchronously and serve updated value (not locked)
    expect(result.isLocked).toBe(false)

    // Verify cache was updated
    const updatedCachedResponse = await cache.match(cacheKeyRequest)
    const updatedCachedValue =
      await updatedCachedResponse!.json<LockValueType>()
    expect(updatedCachedValue.isLocked).toBe(0)
  })
})

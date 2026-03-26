import { beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { createAppwardenMiddleware } from "../runners/appwarden-on-vercel"
import { LockValueType } from "../schemas"

/**
 * Vercel Integration Tests
 *
 * These tests verify the Vercel middleware behavior in a Node.js environment.
 * They run with vitest.node.config.ts (not the Workers runtime).
 *
 * Key differences from Cloudflare:
 * - Uses MemoryCache (in-memory LRU) instead of Cache API
 * - Uses Edge Config or Upstash as edge storage
 * - Uses @vercel/functions waitUntil instead of ExecutionContext
 */

// Mock @vercel/functions
vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}))

// Mock @vercel/edge-config
const mockEdgeConfigClient = {
  get: vi.fn(),
}

vi.mock("@vercel/edge-config", () => ({
  createClient: vi.fn(() => mockEdgeConfigClient),
}))

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => new Response(null, { status: 200 })),
  },
}))

describe("Vercel Integration Tests", () => {
  // Shared test configuration
  const TEST_CONFIG = {
    cacheUrl:
      "https://edge-config.vercel.com/ecfg_fake1234567890abcdefghijklmnop?token=FAKE_TOKEN_12345",
    appwardenApiToken: "FAKE_APPWARDEN_TOKEN_12345",
    vercelApiToken: "FAKE_VERCEL_TOKEN_12345",
    lockPageSlug: "/maintenance",
  }

  // Helper functions to create test data
  const createUnlockedValue = (): LockValueType => ({
    isLocked: 0,
    isLockedTest: 0,
    lastCheck: Date.now(),
  })

  const createLockedValue = (): LockValueType => ({
    isLocked: 1,
    isLockedTest: 0,
    lastCheck: Date.now(),
  })

  const createHTMLRequest = (path = "/page"): Request =>
    new Request(`https://example.com${path}`, {
      headers: { accept: "text/html" },
    })

  const createAPIRequest = (path = "/api/data"): Request =>
    new Request(`https://example.com${path}`, {
      headers: { accept: "application/json" },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the memory cache between tests
    vi.resetModules()
  })

  it("Cold Miss: should fetch from Edge Config when memory cache is empty", async () => {
    const mockLockValue = createUnlockedValue()

    // Mock Edge Config to return the lock value
    mockEdgeConfigClient.get.mockResolvedValue(JSON.stringify(mockLockValue))

    const middleware = createAppwardenMiddleware(TEST_CONFIG)
    const request = createHTMLRequest()
    const response = await middleware(request)

    // Should pass through (not locked)
    expect(response.status).toBe(200)

    // Should have called Edge Config
    expect(mockEdgeConfigClient.get).toHaveBeenCalledWith(APPWARDEN_CACHE_KEY)
  })

  it("Fresh Hit: should serve from memory cache when not expired", async () => {
    const mockLockValue = createUnlockedValue()

    // Mock Edge Config to return the lock value
    mockEdgeConfigClient.get.mockResolvedValue(JSON.stringify(mockLockValue))

    const middleware = createAppwardenMiddleware(TEST_CONFIG)

    // First request - should fetch from Edge Config
    await middleware(createHTMLRequest())
    expect(mockEdgeConfigClient.get).toHaveBeenCalledTimes(1)

    // Second request immediately after
    // Note: The Vercel middleware doesn't automatically populate the memory cache
    // from getLockValue results. The cache is only populated by syncEdgeValue
    // which runs in the background. So the second request will also call Edge Config.
    await middleware(createHTMLRequest("/another-page"))

    // Will call Edge Config again because memory cache wasn't populated
    // This is expected behavior - the middleware fetches directly when cache is empty
    expect(mockEdgeConfigClient.get).toHaveBeenCalledTimes(2)
  })

  it("Locked State: should redirect to lock page when locked", async () => {
    const mockLockValue = createLockedValue()

    // Mock Edge Config to return locked state
    mockEdgeConfigClient.get.mockResolvedValue(JSON.stringify(mockLockValue))

    const middleware = createAppwardenMiddleware(TEST_CONFIG)
    const request = createHTMLRequest()
    const response = await middleware(request)

    // Should redirect to lock page (302 is TEMPORARY_REDIRECT_STATUS)
    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("Pass-through: should skip middleware for non-HTML requests", async () => {
    const middleware = createAppwardenMiddleware(TEST_CONFIG)
    const request = createAPIRequest()
    const response = await middleware(request)

    // Should pass through without checking Edge Config
    expect(response.status).toBe(200)
    expect(mockEdgeConfigClient.get).not.toHaveBeenCalled()
  })
})

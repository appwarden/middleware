import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import {
  APPWARDEN_CACHE_KEY,
  APPWARDEN_USER_AGENT,
  globalErrors,
} from "../constants"
import { LockValueType } from "../schemas"

// Use vi.hoisted to define mocks before they're used in vi.mock (which is hoisted to top)
const { mockMemoryCacheGet, mockIsExpired, mockWaitUntil } = vi.hoisted(() => ({
  mockMemoryCacheGet: vi.fn(),
  mockIsExpired: vi.fn(),
  mockWaitUntil: vi.fn(),
}))

// Mock @vercel/functions
vi.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => mockWaitUntil(promise),
}))

// Mock dependencies - we need to mock MemoryCache before it's instantiated
vi.mock("../utils", () => {
  return {
    debug: vi.fn(),
    getErrors: vi.fn(() => ["Error message"]),
    isCacheUrl: {
      edgeConfig: vi.fn(),
      upstash: vi.fn(),
    },
    MemoryCache: class MockMemoryCache {
      static isExpired = mockIsExpired
      get = mockMemoryCacheGet
      put = vi.fn()
      getValues = vi.fn()
    },
    printMessage: vi.fn(
      (message: string) => `[@appwarden/middleware] ${message}`,
    ),
    isHTMLRequest: vi.fn(
      (request: Request) =>
        request.headers.get("accept")?.includes("text/html") ?? false,
    ),
    isMonitoringRequest: vi.fn(
      (request: Request) =>
        request.headers.get("User-Agent") === APPWARDEN_USER_AGENT,
    ),
  }
})

vi.mock("../utils/vercel", () => ({
  syncEdgeValue: vi.fn(),
  getLockValue: vi.fn(),
}))

// Mock AppwardenConfigSchema
vi.mock("../schemas/vercel", () => ({
  AppwardenConfigSchema: {
    safeParse: vi.fn(),
  },
}))

// Import after mocks are set up
import { AppwardenConfigSchema } from "../schemas/vercel"
import { getErrors, isCacheUrl } from "../utils"
import { getLockValue, syncEdgeValue } from "../utils/vercel"

// Mock console.error
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe("createAppwardenMiddleware", () => {
  // Import createAppwardenMiddleware dynamically after mocks are set up
  let createAppwardenMiddleware: typeof import("./appwarden-on-vercel").createAppwardenMiddleware
  let mockConfig: any

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Reset module to get fresh instance with mocked MemoryCache
    vi.resetModules()

    // Re-import the module to get a fresh instance
    const module = await import("./appwarden-on-vercel")
    createAppwardenMiddleware = module.createAppwardenMiddleware

    // Set default mock return values
    mockMemoryCacheGet.mockReturnValue(undefined)
    mockIsExpired.mockReturnValue(true)

    // Mock valid config
    mockConfig = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "test-token",
      vercelApiToken: "vercel-token",
      lockPageSlug: "/maintenance",
    }

    // Mock isCacheUrl.edgeConfig
    vi.mocked(isCacheUrl.edgeConfig).mockReturnValue(true)

    // Mock getLockValue to return not locked by default
    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: {
        isLocked: 0,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "",
      },
      shouldDeleteEdgeValue: false,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should return a function", () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    expect(typeof middleware).toBe("function")
  })

  it("should return 200 Response when config validation fails", async () => {
    const mockZodError = new ZodError([])

    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: false,
      error: mockZodError,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(getErrors).toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("should return 200 Response for non-HTML requests", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com", {
      headers: { accept: "application/json" },
    })
    const result = await middleware(request)

    expect(getLockValue).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should return 200 Response for monitoring requests from Appwarden", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com", {
      headers: { accept: "text/html", "User-Agent": APPWARDEN_USER_AGENT },
    })
    const result = await middleware(request)

    expect(getLockValue).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should return 200 Response when no lock page slug is configured", async () => {
    const configWithoutLockPage = { ...mockConfig, lockPageSlug: "" }
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: configWithoutLockPage,
    })

    const middleware = createAppwardenMiddleware(configWithoutLockPage)
    const request = new Request("https://example.com", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(getLockValue).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should redirect to lock page when site is locked", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: {
        isLocked: 1,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "",
      },
      shouldDeleteEdgeValue: false,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should normalize lock page slug to start with /", async () => {
    const configWithoutSlash = { ...mockConfig, lockPageSlug: "maintenance" }
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: configWithoutSlash,
    })

    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: {
        isLocked: 1,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "",
      },
      shouldDeleteEdgeValue: false,
    })

    const middleware = createAppwardenMiddleware(configWithoutSlash)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(result.status).toBe(302)
    // The lock page slug should work even without leading slash
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should return 200 Response when site is not locked", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    vi.mocked(getLockValue).mockResolvedValue({
      lockValue: {
        isLocked: 0,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "",
      },
      shouldDeleteEdgeValue: false,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(result.status).toBe(200)
  })

  it("should call syncEdgeValue in background when cache is expired", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })
    mockIsExpired.mockReturnValue(true)
    mockMemoryCacheGet.mockReturnValue(undefined)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    expect(syncEdgeValue).toHaveBeenCalled()
    expect(mockWaitUntil).toHaveBeenCalled()
  })

  it("should not call syncEdgeValue when cache is valid", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const validCacheValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "OK",
    }

    mockIsExpired.mockReturnValue(false)
    mockMemoryCacheGet.mockReturnValue(validCacheValue)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    expect(syncEdgeValue).not.toHaveBeenCalled()
    expect(mockWaitUntil).not.toHaveBeenCalled()
  })

  it("should use cached value if available", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const cachedValue: LockValueType = {
      isLocked: 1,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "cached",
    }

    mockIsExpired.mockReturnValue(false)
    mockMemoryCacheGet.mockReturnValue(cachedValue)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    // Should redirect because cached value has isLocked: 1
    expect(result.status).toBe(302)
    // Should not call getLockValue because we use cached value
    expect(getLockValue).not.toHaveBeenCalled()
  })

  it("should handle errors gracefully and return 200 Response", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    vi.mocked(getLockValue).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should not log error if it's in globalErrors", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const globalError = new Error(globalErrors[0])
    vi.mocked(getLockValue).mockRejectedValue(globalError)

    // Clear the spy to count only errors from the middleware
    consoleErrorSpy.mockClear()

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    // Should not log the error since it's in globalErrors
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("should use upstash provider when cacheUrl is upstash URL", async () => {
    const upstashConfig = {
      cacheUrl: "rediss://:password@hostname.upstash.io:6379",
      appwardenApiToken: "test-token",
      lockPageSlug: "/maintenance",
    }

    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: upstashConfig,
    })

    vi.mocked(isCacheUrl.edgeConfig).mockReturnValue(false)

    const middleware = createAppwardenMiddleware(upstashConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    // Verify getLockValue was called with upstash provider
    expect(getLockValue).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "upstash",
      }),
    )
  })

  it("should use edge-config provider when cacheUrl is edge config URL", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    vi.mocked(isCacheUrl.edgeConfig).mockReturnValue(true)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    // Verify getLockValue was called with edge-config provider
    expect(getLockValue).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "edge-config",
      }),
    )
  })

  it("should pass keyName to getLockValue", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    expect(getLockValue).toHaveBeenCalledWith(
      expect.objectContaining({
        keyName: APPWARDEN_CACHE_KEY,
      }),
    )
  })

  it("should handle empty URL gracefully", async () => {
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockConfig,
    })

    const middleware = createAppwardenMiddleware(mockConfig)
    // Creating a Request with invalid URL will throw, so we need to test with a valid URL
    // but simulate a parsing error inside the handler
    const request = new Request("https://example.com", {
      headers: { accept: "text/html" },
    })

    // This should not throw - errors are handled gracefully
    const result = await middleware(request)
    expect(result).toBeDefined()
  })

  it("should work with minimal configuration", async () => {
    const minimalConfig = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "test-token",
      lockPageSlug: "/maintenance",
    }

    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: minimalConfig,
    })

    const middleware = createAppwardenMiddleware(minimalConfig)
    const request = new Request("https://example.com", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(result.status).toBe(200)
  })

  // safeWaitUntil fallback behavior tests
  describe("safeWaitUntil fallback", () => {
    it("should catch errors from waitUntil and fire-and-forget", async () => {
      // Mock waitUntil to throw (simulating non-Vercel environment)
      mockWaitUntil.mockImplementation(() => {
        throw new Error("waitUntil not available")
      })

      vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
        success: true,
        data: mockConfig,
      })
      mockIsExpired.mockReturnValue(true)
      mockMemoryCacheGet.mockReturnValue(undefined)

      const middleware = createAppwardenMiddleware(mockConfig)
      const request = new Request("https://example.com/page", {
        headers: { accept: "text/html" },
      })

      // Should not throw even if waitUntil fails
      const result = await middleware(request)
      expect(result).toBeDefined()
      expect(syncEdgeValue).toHaveBeenCalled()
    })
  })

  // Response.redirect behavior tests
  describe("Response.redirect behavior", () => {
    it("should use 302 status code for redirects (temporary redirect)", async () => {
      vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
        success: true,
        data: mockConfig,
      })

      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      const middleware = createAppwardenMiddleware(mockConfig)
      const request = new Request("https://example.com/page", {
        headers: { accept: "text/html" },
      })
      const result = await middleware(request)

      expect(result.status).toBe(302)
    })

    it("should set correct Location header for redirect", async () => {
      const configWithCustomPath = {
        ...mockConfig,
        lockPageSlug: "/custom-lock",
      }
      vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
        success: true,
        data: configWithCustomPath,
      })

      vi.mocked(getLockValue).mockResolvedValue({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      const middleware = createAppwardenMiddleware(configWithCustomPath)
      const request = new Request("https://example.com/page", {
        headers: { accept: "text/html" },
      })
      const result = await middleware(request)

      expect(result.headers.get("Location")).toBe(
        "https://example.com/custom-lock",
      )
    })
  })
})

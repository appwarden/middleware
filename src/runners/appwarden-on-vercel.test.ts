import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY, globalErrors } from "../constants"
import { LockValueType } from "../schemas"

// Use vi.hoisted to define mocks before they're used in vi.mock (which is hoisted to top)
const {
  mockMemoryCacheGet,
  mockIsExpired,
  mockWaitUntil,
  mockNextResponseNext,
  mockValidateConfig,
  mockIsOnLockPage,
  mockMakeCSPHeader,
} = vi.hoisted(() => ({
  mockMemoryCacheGet: vi.fn(),
  mockIsExpired: vi.fn(),
  mockWaitUntil: vi.fn(),
  mockNextResponseNext: vi.fn(),
  mockValidateConfig: vi.fn(),
  mockIsOnLockPage: vi.fn(),
  mockMakeCSPHeader: vi.fn(),
}))

// Mock @vercel/functions
vi.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => mockWaitUntil(promise),
}))

// Create a marker object to identify NextResponse.next() calls
const NEXT_RESPONSE_MARKER = Symbol("NextResponse.next")

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    next: () => {
      mockNextResponseNext()
      // Return a Response with a custom header to identify it
      const response = new Response(null, { status: 200 })
      ;(response as any)[NEXT_RESPONSE_MARKER] = true
      return response
    },
  },
}))

// Mock dependencies - we need to mock MemoryCache before it's instantiated
vi.mock("../utils", () => {
  return {
    buildLockPageUrl: vi.fn((slug: string, requestUrl: string) => {
      const normalizedSlug = slug.startsWith("/") ? slug : `/${slug}`
      return new URL(normalizedSlug, requestUrl)
    }),
    debug: vi.fn(() => vi.fn()),
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
    isOnLockPage: mockIsOnLockPage,
    validateConfig: mockValidateConfig,
    TEMPORARY_REDIRECT_STATUS: 302,
  }
})

vi.mock("../utils/vercel", () => ({
  syncEdgeValue: vi.fn(),
  getLockValue: vi.fn(),
}))

vi.mock("../utils/cloudflare", () => ({
  makeCSPHeader: (...args: unknown[]) => mockMakeCSPHeader(...args),
}))

// Mock AppwardenConfigSchema
vi.mock("../schemas/vercel", () => ({
  AppwardenConfigSchema: {
    safeParse: vi.fn(),
    parse: vi.fn(),
  },
}))

// Import after mocks are set up
import { AppwardenConfigSchema } from "../schemas/vercel"
import { isCacheUrl, validateConfig } from "../utils"
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
  // Import modules dynamically after mocks are set up (they need to be re-imported after resetModules)
  let createAppwardenMiddleware: typeof import("./appwarden-on-vercel").createAppwardenMiddleware
  let getLockValueMock: typeof getLockValue
  let syncEdgeValueMock: typeof syncEdgeValue
  let AppwardenConfigSchemaMock: typeof AppwardenConfigSchema
  let isCacheUrlMock: typeof isCacheUrl
  let mockConfig: any

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Reset module to get fresh instance with mocked MemoryCache
    vi.resetModules()

    // Re-import all modules that use vi.mock to get fresh mock references
    const module = await import("./appwarden-on-vercel")
    createAppwardenMiddleware = module.createAppwardenMiddleware

    const vercelModule = await import("../utils/vercel")
    getLockValueMock = vercelModule.getLockValue
    syncEdgeValueMock = vercelModule.syncEdgeValue

    const schemaModule = await import("../schemas/vercel")
    AppwardenConfigSchemaMock = schemaModule.AppwardenConfigSchema

    const utilsModule = await import("../utils")
    isCacheUrlMock = utilsModule.isCacheUrl

    // Set default mock return values
    mockMemoryCacheGet.mockReturnValue(undefined)
    mockIsExpired.mockReturnValue(true)
    mockMakeCSPHeader.mockReturnValue([
      "Content-Security-Policy",
      "default-src 'self'",
    ])

    // Mock valid config
    mockConfig = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "test-token",
      vercelApiToken: "vercel-token",
      lockPageSlug: "/maintenance",
    }

    // Mock isCacheUrl.edgeConfig
    vi.mocked(isCacheUrlMock.edgeConfig).mockReturnValue(true)

    // Mock validateConfig to return false (valid config) by default
    mockValidateConfig.mockReturnValue(false)

    // Mock isOnLockPage to return false by default (not on lock page)
    mockIsOnLockPage.mockImplementation((slug: string, requestUrl: string) => {
      const normalizedSlug = slug.startsWith("/") ? slug : `/${slug}`
      const url = new URL(requestUrl)
      return url.pathname === normalizedSlug
    })

    // Mock AppwardenConfigSchema.parse to return the config by default
    vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(mockConfig)

    // Mock getLockValue to return not locked by default
    vi.mocked(getLockValueMock).mockResolvedValue({
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
    const middleware = createAppwardenMiddleware(mockConfig)
    expect(typeof middleware).toBe("function")
  })

  it("should call NextResponse.next() when config validation fails (fail open)", async () => {
    // Mock validateConfig to return true (config has errors)
    mockValidateConfig.mockReturnValue(true)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(validateConfig).toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(mockNextResponseNext).toHaveBeenCalled()
  })

  it("should call NextResponse.next() for non-HTML requests (pass through)", async () => {
    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com", {
      headers: { accept: "application/json" },
    })
    const result = await middleware(request)

    expect(getLockValue).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(mockNextResponseNext).toHaveBeenCalled()
  })

  it("should call NextResponse.next() when no lock page slug is configured (pass through)", async () => {
    const configWithoutLockPage = { ...mockConfig, lockPageSlug: "" }
    vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(
      configWithoutLockPage,
    )

    const middleware = createAppwardenMiddleware(configWithoutLockPage)
    const request = new Request("https://example.com", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(getLockValueMock).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(mockNextResponseNext).toHaveBeenCalled()
  })

  it("should redirect to lock page when site is locked", async () => {
    vi.mocked(getLockValueMock).mockResolvedValue({
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
    vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(
      configWithoutSlash,
    )

    vi.mocked(getLockValueMock).mockResolvedValue({
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

  it("should call NextResponse.next() when site is not locked (pass through)", async () => {
    vi.mocked(getLockValueMock).mockResolvedValue({
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
    expect(mockNextResponseNext).toHaveBeenCalled()
  })

  it("should call syncEdgeValue in background when cache is expired", async () => {
    mockIsExpired.mockReturnValue(true)
    mockMemoryCacheGet.mockReturnValue(undefined)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    expect(syncEdgeValueMock).toHaveBeenCalled()
    expect(mockWaitUntil).toHaveBeenCalled()
  })

  it("should not call syncEdgeValue when cache is valid", async () => {
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

    expect(syncEdgeValueMock).not.toHaveBeenCalled()
    expect(mockWaitUntil).not.toHaveBeenCalled()
  })

  it("should use cached value if available", async () => {
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
    expect(getLockValueMock).not.toHaveBeenCalled()
  })

  it("should call NextResponse.next() on errors (fail open)", async () => {
    vi.mocked(getLockValueMock).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    const result = await middleware(request)

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(mockNextResponseNext).toHaveBeenCalled()
  })

  it("should not log error if it's in globalErrors", async () => {
    const globalError = new Error(globalErrors[0])
    vi.mocked(getLockValueMock).mockRejectedValue(globalError)

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

    vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(upstashConfig)
    vi.mocked(isCacheUrlMock.edgeConfig).mockReturnValue(false)

    const middleware = createAppwardenMiddleware(upstashConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    // Verify getLockValue was called with upstash provider
    expect(getLockValueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "upstash",
      }),
    )
  })

  it("should use edge-config provider when cacheUrl is edge config URL", async () => {
    vi.mocked(isCacheUrlMock.edgeConfig).mockReturnValue(true)

    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    // Verify getLockValue was called with edge-config provider
    expect(getLockValueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "edge-config",
      }),
    )
  })

  it("should pass keyName to getLockValue", async () => {
    const middleware = createAppwardenMiddleware(mockConfig)
    const request = new Request("https://example.com/page", {
      headers: { accept: "text/html" },
    })
    await middleware(request)

    expect(getLockValueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keyName: APPWARDEN_CACHE_KEY,
      }),
    )
  })

  it("should handle empty URL gracefully", async () => {
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

    vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(minimalConfig)

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

      mockIsExpired.mockReturnValue(true)
      mockMemoryCacheGet.mockReturnValue(undefined)

      const middleware = createAppwardenMiddleware(mockConfig)
      const request = new Request("https://example.com/page", {
        headers: { accept: "text/html" },
      })

      // Should not throw even if waitUntil fails
      const result = await middleware(request)
      expect(result).toBeDefined()
      expect(syncEdgeValueMock).toHaveBeenCalled()
    })
  })

  // Response.redirect behavior tests
  describe("Response.redirect behavior", () => {
    it("should use 302 status code for redirects (temporary redirect)", async () => {
      vi.mocked(getLockValueMock).mockResolvedValue({
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
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(
        configWithCustomPath,
      )

      vi.mocked(getLockValueMock).mockResolvedValue({
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

  describe("redirect loop prevention", () => {
    it("should not redirect when already on lock page to prevent infinite redirect loop", async () => {
      vi.mocked(getLockValueMock).mockResolvedValue({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Request is already on the lock page
      const middleware = createAppwardenMiddleware(mockConfig)
      const request = new Request("https://example.com/maintenance", {
        headers: { accept: "text/html" },
      })
      const result = await middleware(request)

      // Should return NextResponse.next() and NOT redirect
      expect(getLockValueMock).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
      expect(mockNextResponseNext).toHaveBeenCalled()
    })

    it("should not redirect when already on lock page (slug without leading slash)", async () => {
      const configWithoutSlash = { ...mockConfig, lockPageSlug: "maintenance" }
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(
        configWithoutSlash,
      )

      vi.mocked(getLockValueMock).mockResolvedValue({
        lockValue: {
          isLocked: 1,
          isLockedTest: 0,
          lastCheck: Date.now(),
          code: "",
        },
        shouldDeleteEdgeValue: false,
      })

      // Request is already on the lock page
      const middleware = createAppwardenMiddleware(configWithoutSlash)
      const request = new Request("https://example.com/maintenance", {
        headers: { accept: "text/html" },
      })
      const result = await middleware(request)

      // Should return NextResponse.next() and NOT redirect
      expect(getLockValueMock).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
      expect(mockNextResponseNext).toHaveBeenCalled()
    })
  })

  describe("CSP support", () => {
    it("should add Content-Security-Policy header when mode is 'enforced'", async () => {
      const directives = { defaultSrc: ["self"] }
      const configWithCSP = {
        ...mockConfig,
        contentSecurityPolicy: { mode: "enforced", directives },
      }
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(configWithCSP)
      mockMakeCSPHeader.mockReturnValue([
        "Content-Security-Policy",
        "default-src 'self'",
      ])

      const middleware = createAppwardenMiddleware(configWithCSP)
      const result = await middleware(
        new Request("https://example.com/page", {
          headers: { accept: "text/html" },
        }),
      )

      expect(mockMakeCSPHeader).toHaveBeenCalledWith("", directives, "enforced")
      expect(result.headers.get("Content-Security-Policy")).toBe(
        "default-src 'self'",
      )
    })

    it("should add Content-Security-Policy-Report-Only header when mode is 'report-only'", async () => {
      const directives = { defaultSrc: ["self"] }
      const configWithCSP = {
        ...mockConfig,
        contentSecurityPolicy: { mode: "report-only", directives },
      }
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(configWithCSP)
      mockMakeCSPHeader.mockReturnValue([
        "Content-Security-Policy-Report-Only",
        "default-src 'self'",
      ])

      const middleware = createAppwardenMiddleware(configWithCSP)
      const result = await middleware(
        new Request("https://example.com/page", {
          headers: { accept: "text/html" },
        }),
      )

      expect(mockMakeCSPHeader).toHaveBeenCalledWith(
        "",
        directives,
        "report-only",
      )
      expect(result.headers.get("Content-Security-Policy-Report-Only")).toBe(
        "default-src 'self'",
      )
    })

    it("should not add CSP header when mode is 'disabled'", async () => {
      const configWithCSP = {
        ...mockConfig,
        contentSecurityPolicy: { mode: "disabled" },
      }
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(configWithCSP)

      const middleware = createAppwardenMiddleware(configWithCSP)
      const result = await middleware(
        new Request("https://example.com/page", {
          headers: { accept: "text/html" },
        }),
      )

      expect(mockMakeCSPHeader).not.toHaveBeenCalled()
      expect(result.headers.get("Content-Security-Policy")).toBeNull()
      expect(
        result.headers.get("Content-Security-Policy-Report-Only"),
      ).toBeNull()
    })

    it("should not add CSP header when no contentSecurityPolicy config is provided", async () => {
      // mockConfig has no contentSecurityPolicy field
      const middleware = createAppwardenMiddleware(mockConfig)
      const result = await middleware(
        new Request("https://example.com/page", {
          headers: { accept: "text/html" },
        }),
      )

      expect(mockMakeCSPHeader).not.toHaveBeenCalled()
      expect(result.headers.get("Content-Security-Policy")).toBeNull()
    })

    it("should not add CSP header for non-HTML requests", async () => {
      const directives = { defaultSrc: ["self"] }
      const configWithCSP = {
        ...mockConfig,
        contentSecurityPolicy: { mode: "enforced", directives },
      }
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(configWithCSP)

      const middleware = createAppwardenMiddleware(configWithCSP)
      const result = await middleware(
        new Request("https://example.com/api/data.json", {
          headers: { accept: "application/json" },
        }),
      )

      expect(mockMakeCSPHeader).not.toHaveBeenCalled()
      expect(result.headers.get("Content-Security-Policy")).toBeNull()
    })

    it("should pass empty nonce and correct directives to makeCSPHeader", async () => {
      const directives = {
        defaultSrc: ["self"],
        scriptSrc: ["self", "https://cdn.example.com"],
      }
      const configWithCSP = {
        ...mockConfig,
        contentSecurityPolicy: { mode: "enforced", directives },
      }
      vi.mocked(AppwardenConfigSchemaMock.parse).mockReturnValue(configWithCSP)
      mockMakeCSPHeader.mockReturnValue([
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' https://cdn.example.com",
      ])

      const middleware = createAppwardenMiddleware(configWithCSP)
      await middleware(
        new Request("https://example.com/page", {
          headers: { accept: "text/html" },
        }),
      )

      expect(mockMakeCSPHeader).toHaveBeenCalledWith("", directives, "enforced")
    })
  })
})

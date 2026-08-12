import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkLockStatus } from "../core"
import { CloudflareConfigType } from "../schemas"
import { MiddlewareContext } from "../types"
import { store } from "../utils/cloudflare"
import { resolveMiddlewareAction } from "../utils/route-matching"
import { useAppwarden } from "./use-appwarden"

// Mock dependencies
vi.mock("../core", () => ({
  checkLockStatus: vi.fn(),
}))

vi.mock("../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils")>()
  return {
    ...actual,
    printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
    buildLockPageUrl: vi.fn((slug: string, requestUrl: string) => {
      const url = new URL(requestUrl)
      url.pathname = slug.startsWith("/") ? slug : `/${slug}`
      return url
    }),
    createRedirect: vi.fn((url: URL) => {
      return new Response(null, {
        status: 302,
        headers: { Location: url.toString() },
      })
    }),
    isHTMLRequest: vi.fn(
      (request: Request) =>
        request.headers.get("accept")?.includes("text/html") ?? false,
    ),
    isOnLockPage: vi.fn((lockPageSlug: string, requestUrl: string) => {
      const normalizedSlug = lockPageSlug.startsWith("/")
        ? lockPageSlug
        : `/${lockPageSlug}`
      const url = new URL(requestUrl)
      return url.pathname === normalizedSlug
    }),
  }
})

vi.mock("../utils/route-matching", () => ({
  resolveMiddlewareAction: vi.fn(),
}))

vi.mock("../utils/cloudflare", () => ({
  store: {
    json: vi.fn(),
  },
}))

// Mock console.error
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe("useAppwarden", () => {
  let mockContext: MiddlewareContext
  let mockNext: () => Promise<void>
  let mockInput: CloudflareConfigType
  let mockEdgeCache: ReturnType<typeof store.json>
  let mockCachesOpen: typeof caches.open

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup test data - use Accept header for HTML requests
    mockContext = {
      request: new Request("https://example.com", {
        headers: { accept: "text/html" },
      }),
      response: new Response("Test response"),
      hostname: "example.com",
      waitUntil: vi.fn(),
      debug: vi.fn(),
    }

    mockNext = vi.fn(async () => {})

    mockInput = {
      debug: false,
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://api.appwarden.io",
    }

    mockEdgeCache = {
      getValue: vi.fn(),
      updateValue: vi.fn(),
      deleteValue: vi.fn(),
    }

    // Mock store.json to return mockEdgeCache
    vi.mocked(store.json).mockReturnValue(mockEdgeCache)

    // Mock caches.open
    mockCachesOpen = vi.fn().mockResolvedValue({} as Cache)
    // Mock global.caches
    Object.defineProperty(global, "caches", {
      value: {
        open: mockCachesOpen,
        default: {} as Cache,
        delete: vi.fn(),
        has: vi.fn(),
        match: vi.fn(),
      },
      writable: true,
    })

    // Default: site is not locked
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })

    // Default: route-matching resolves to website
    vi.mocked(resolveMiddlewareAction).mockReturnValue("website")
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should call next() to run the middleware after the origin is fetched", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it("should not check lock status for non-HTML requests", async () => {
    // Set up a non-HTML request (no Accept: text/html header)
    mockContext.request = new Request("https://example.com/api/data", {
      headers: { accept: "application/json" },
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(checkLockStatus).not.toHaveBeenCalled()
    // Should still call next() to fetch the origin
    expect(mockNext).toHaveBeenCalled()
  })

  it("should not check lock status when already on lock page and should call next()", async () => {
    // Set up a request that is already on the lock page
    mockContext.request = new Request("https://example.com/maintenance", {
      headers: { accept: "text/html" },
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Should NOT check lock status to prevent infinite redirect loop
    expect(checkLockStatus).not.toHaveBeenCalled()
    // Should still call next() to fetch the origin (render the lock page)
    expect(mockNext).toHaveBeenCalled()
  })

  it("should call checkLockStatus for HTML requests", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(checkLockStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        request: mockContext.request,
        appwardenApiToken: mockInput.appwardenApiToken,
        debug: mockInput.debug,
        lockPageSlug: mockInput.website?.lockPageSlug,
        waitUntil: expect.any(Function),
      }),
    )
  })

  it("should redirect to lock page when site is locked", async () => {
    // Mock checkLockStatus to return locked state
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Verify response is a redirect
    expect(mockContext.response).toBeInstanceOf(Response)
    expect(mockContext.response!.status).toBe(302)
    expect(mockContext.response!.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
    // Should not call next() when redirecting
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should not redirect when site is not locked", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Response should not be a redirect
    expect(mockContext.response?.status).not.toBe(302)
    expect(mockNext).toHaveBeenCalled()
  })

  it("should handle errors gracefully and call next()", async () => {
    // Simulate an error in checkLockStatus
    vi.mocked(checkLockStatus).mockRejectedValue(new Error("Test error"))

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Appwarden encountered an unknown error"),
    )
    // Should still call next() on error
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it("should not call next() twice when error occurs after next() was already called", async () => {
    // Simulate the happy path completing (next called), then an error thrown
    // This tests the nextCalled guard in the catch block
    let firstCall = true
    vi.mocked(checkLockStatus).mockImplementation(async () => {
      if (firstCall) {
        firstCall = false
        return { isLocked: false, isTestLock: false }
      }
      throw new Error("Unexpected second call")
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // next() should only be called once
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it("should pass the correct config to checkLockStatus", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Verify checkLockStatus was called with expected parameters
    expect(checkLockStatus).toHaveBeenCalledWith({
      request: mockContext.request,
      appwardenApiToken: mockInput.appwardenApiToken,
      appwardenApiHostname: mockInput.appwardenApiHostname,
      debug: mockInput.debug,
      lockPageSlug: mockInput.website?.lockPageSlug,
      waitUntil: expect.any(Function),
    })
  })

  it("should correctly wrap waitUntil in the context", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Extract the waitUntil function that was passed to checkLockStatus
    const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
    const waitUntilFn = callArgs.waitUntil

    // Call the waitUntil function
    const testPromise = Promise.resolve()
    waitUntilFn(testPromise)

    // Verify that the original waitUntil was called with the same promise
    expect(mockContext.waitUntil).toHaveBeenCalledWith(testPromise)
  })

  describe("multidomainConfig", () => {
    it("should use lockPageSlug from multidomainConfig when hostname matches", async () => {
      const inputWithMultidomain: CloudflareConfigType = {
        debug: false,
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        multidomainConfig: {
          "example.com": { website: { lockPageSlug: "/maintenance-example" } },
          "other.com": { website: { lockPageSlug: "/maintenance-other" } },
        },
      }

      mockContext.request = new Request("https://example.com/page", {
        headers: { accept: "text/html" },
      })
      mockContext.hostname = "example.com"

      const middleware = useAppwarden(inputWithMultidomain)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      expect(callArgs.lockPageSlug).toBe("/maintenance-example")
    })

    it("should use lockPageSlug from different domain in multidomainConfig", async () => {
      const inputWithMultidomain: CloudflareConfigType = {
        debug: false,
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        multidomainConfig: {
          "example.com": { website: { lockPageSlug: "/maintenance-example" } },
          "other.com": { website: { lockPageSlug: "/maintenance-other" } },
        },
      }

      mockContext.request = new Request("https://other.com/page", {
        headers: { accept: "text/html" },
      })
      mockContext.hostname = "other.com"

      const middleware = useAppwarden(inputWithMultidomain)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      expect(callArgs.lockPageSlug).toBe("/maintenance-other")
    })

    it("should skip lock check for unconfigured domains when using multidomainConfig", async () => {
      const inputWithMultidomain: CloudflareConfigType = {
        debug: false,
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        multidomainConfig: {
          "example.com": { website: { lockPageSlug: "/maintenance-example" } },
        },
      }

      // Simulate no matching website/api config for this domain
      vi.mocked(resolveMiddlewareAction).mockReturnValue(null)

      mockContext.request = new Request("https://unknown-domain.com/page", {
        headers: { accept: "text/html" },
      })
      mockContext.hostname = "unknown-domain.com"

      const middleware = useAppwarden(inputWithMultidomain)
      await middleware(mockContext, mockNext)

      // checkLockStatus should NOT be called for unconfigured domains
      expect(checkLockStatus).not.toHaveBeenCalled()
      // But next() should still be called
      expect(mockNext).toHaveBeenCalled()
    })

    it("should fall back to root lockPageSlug when multidomainConfig is not provided", async () => {
      const inputWithRootOnly: CloudflareConfigType = {
        debug: false,
        website: { lockPageSlug: "/root-maintenance" },
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
      }

      mockContext.request = new Request("https://any-domain.com/page", {
        headers: { accept: "text/html" },
      })
      mockContext.hostname = "any-domain.com"

      const middleware = useAppwarden(inputWithRootOnly)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      expect(callArgs.lockPageSlug).toBe("/root-maintenance")
    })

    it("should prefer multidomainConfig lockPageSlug over root lockPageSlug", async () => {
      const inputWithBoth: CloudflareConfigType = {
        debug: false,
        website: { lockPageSlug: "/root-maintenance" },
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        multidomainConfig: {
          "example.com": {
            website: { lockPageSlug: "/domain-specific-maintenance" },
          },
        },
      }

      mockContext.request = new Request("https://example.com/page", {
        headers: { accept: "text/html" },
      })
      mockContext.hostname = "example.com"

      const middleware = useAppwarden(inputWithBoth)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      expect(callArgs.lockPageSlug).toBe("/domain-specific-maintenance")
    })

    it("should fall back to root lockPageSlug for unconfigured domains when both are provided", async () => {
      const inputWithBoth: CloudflareConfigType = {
        debug: false,
        website: { lockPageSlug: "/root-maintenance" },
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        multidomainConfig: {
          "example.com": {
            website: { lockPageSlug: "/domain-specific-maintenance" },
          },
        },
      }

      mockContext.request = new Request("https://other-domain.com/page", {
        headers: { accept: "text/html" },
      })
      mockContext.hostname = "other-domain.com"

      const middleware = useAppwarden(inputWithBoth)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      expect(callArgs.lockPageSlug).toBe("/root-maintenance")
    })
  })

  describe("HTTP Method Handling", () => {
    it("should skip lock check for OPTIONS requests (CORS preflight)", async () => {
      mockContext.request = new Request("https://example.com", {
        method: "OPTIONS",
        headers: { accept: "text/html" },
      })

      const middleware = useAppwarden(mockInput)
      await middleware(mockContext, mockNext)

      // Should not call checkLockStatus for OPTIONS
      expect(checkLockStatus).not.toHaveBeenCalled()

      // Should still call next to forward the request (CORS preflight)
      expect(mockNext).toHaveBeenCalled()
    })

    it("should process GET requests normally", async () => {
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      mockContext.request = new Request("https://example.com", {
        method: "GET",
        headers: { accept: "text/html" },
      })

      const middleware = useAppwarden(mockInput)
      await middleware(mockContext, mockNext)

      // Should call checkLockStatus for GET
      expect(checkLockStatus).toHaveBeenCalled()

      // Should call next when not locked
      expect(mockNext).toHaveBeenCalled()
    })

    it("should process POST requests normally", async () => {
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      mockContext.request = new Request("https://example.com", {
        method: "POST",
        headers: { accept: "text/html" },
      })

      const middleware = useAppwarden(mockInput)
      await middleware(mockContext, mockNext)

      // Should call checkLockStatus for POST
      expect(checkLockStatus).toHaveBeenCalled()

      // Should call next when not locked
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe("middleware action control flow", () => {
    it("should bypass lock check and still call next() when action is bypass", async () => {
      vi.mocked(resolveMiddlewareAction).mockReturnValue("bypass")

      const middleware = useAppwarden(mockInput)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).not.toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it("should return configured API lock response and not call next() when API path is locked", async () => {
      vi.mocked(resolveMiddlewareAction).mockReturnValue("api")
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: true,
        isTestLock: false,
      })

      const inputWithApi: CloudflareConfigType = {
        ...mockInput,
        api: {
          basePaths: ["/api"],
          response: {
            status: 503,
            body: '{"error":"Service unavailable"}',
            headers: [{ name: "X-Custom-Header", value: "locked" }],
          },
        },
      }

      const middleware = useAppwarden(inputWithApi)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          request: mockContext.request,
          lockPageSlug: mockInput.website?.lockPageSlug,
        }),
      )
      expect(mockContext.response).toBeInstanceOf(Response)
      expect(mockContext.response!.status).toBe(503)
      expect(await mockContext.response!.text()).toBe(
        '{"error":"Service unavailable"}',
      )
      expect(mockContext.response!.headers.get("X-Custom-Header")).toBe(
        "locked",
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should call next() when API path is unlocked", async () => {
      vi.mocked(resolveMiddlewareAction).mockReturnValue("api")
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      const inputWithApi: CloudflareConfigType = {
        ...mockInput,
        api: {
          basePaths: ["/api"],
        } as any,
      }

      const middleware = useAppwarden(inputWithApi)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it("should use default API lock response when api.response is not configured", async () => {
      vi.mocked(resolveMiddlewareAction).mockReturnValue("api")
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: true,
        isTestLock: false,
      })

      const inputWithApi: CloudflareConfigType = {
        ...mockInput,
        api: {
          basePaths: ["/api"],
        } as any,
      }

      const middleware = useAppwarden(inputWithApi)
      await middleware(mockContext, mockNext)

      expect(mockContext.response).toBeInstanceOf(Response)
      expect(mockContext.response!.status).toBe(503)
      expect(await mockContext.response!.text()).toBe(
        '{"error":"Service unavailable"}',
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it("should wrap context.waitUntil for API lock checks", async () => {
      vi.mocked(resolveMiddlewareAction).mockReturnValue("api")
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      const inputWithApi: CloudflareConfigType = {
        ...mockInput,
        api: {
          basePaths: ["/api"],
        } as any,
      }

      const middleware = useAppwarden(inputWithApi)
      await middleware(mockContext, mockNext)

      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      const waitUntilFn = callArgs.waitUntil
      const testPromise = Promise.resolve()
      waitUntilFn(testPromise)

      expect(mockContext.waitUntil).toHaveBeenCalledWith(testPromise)
    })
  })
})

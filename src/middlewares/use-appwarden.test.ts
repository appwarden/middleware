import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { checkLockStatus } from "../core"
import { handleResetCache, isResetCacheRequest } from "../handlers"
import { CloudflareConfigType } from "../schemas"
import { MiddlewareContext } from "../types"
import { renderLockPage } from "../utils"
import { store } from "../utils/cloudflare"
import { useAppwarden } from "./use-appwarden"

// Mock dependencies
vi.mock("../core", () => ({
  checkLockStatus: vi.fn(),
}))

vi.mock("../handlers", () => ({
  handleResetCache: vi.fn(),
  isResetCacheRequest: vi.fn(),
}))

vi.mock("../utils", () => ({
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
  renderLockPage: vi.fn(() => new Response("Locked page")),
  isHTMLResponse: vi.fn(
    (response: Response) =>
      response.headers.get("Content-Type")?.includes("text/html") ?? false,
  ),
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

    // Setup test data
    mockContext = {
      request: new Request("https://example.com"),
      response: new Response("Test response", {
        headers: { "Content-Type": "text/html" },
      }),
      hostname: "example.com",
      waitUntil: vi.fn(),
    }

    mockNext = vi.fn(async () => {})

    mockInput = {
      debug: false,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
      middleware: { before: [], after: [] },
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

    // Default mock implementations
    vi.mocked(isResetCacheRequest).mockReturnValue(false)
    // Default: site is not locked
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should call next() to run the middleware after the origin is fetched", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalled()
  })

  it("should initialize the edge cache with the correct parameters", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(mockCachesOpen).toHaveBeenCalledWith("appwarden:lock")
    expect(store.json).toHaveBeenCalledWith(
      {
        serviceOrigin: "https://example.com",
        cache: expect.any(Object),
      },
      APPWARDEN_CACHE_KEY,
    )
  })

  it("should handle reset cache request when detected", async () => {
    vi.mocked(isResetCacheRequest).mockReturnValue(true)

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(handleResetCache).toHaveBeenCalledWith(
      APPWARDEN_CACHE_KEY,
      "cloudflare-cache",
      mockEdgeCache,
      mockContext.request,
    )
    // Should return early and not process further
    expect(checkLockStatus).not.toHaveBeenCalled()
  })

  it("should not check lock status for non-HTML responses", async () => {
    // Set up a non-HTML response
    mockContext.response = new Response("Test response", {
      headers: { "Content-Type": "application/json" },
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(checkLockStatus).not.toHaveBeenCalled()
  })

  it("should call checkLockStatus for HTML responses", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(checkLockStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        request: mockContext.request,
        appwardenApiToken: mockInput.appwardenApiToken,
        debug: mockInput.debug,
        lockPageSlug: mockInput.lockPageSlug,
        waitUntil: expect.any(Function),
      }),
    )
  })

  it("should set the response to the lock page when site is locked", async () => {
    // Create a mock response for renderLockPage
    const mockLockPageResponse = new Response("Locked page")
    vi.mocked(renderLockPage).mockResolvedValue(mockLockPageResponse)

    // Mock checkLockStatus to return locked state
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(renderLockPage).toHaveBeenCalledWith({
      lockPageSlug: mockInput.lockPageSlug,
      requestUrl: new URL(mockContext.request.url),
    })
    expect(mockContext.response).toBe(mockLockPageResponse)
  })

  it("should not render lock page when site is not locked", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(renderLockPage).not.toHaveBeenCalled()
  })

  it("should handle errors gracefully", async () => {
    // Simulate an error
    vi.mocked(store.json).mockImplementation(() => {
      throw new Error("Test error")
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Appwarden encountered an unknown error"),
    )
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
      lockPageSlug: mockInput.lockPageSlug,
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
        middleware: { before: [], after: [] },
        multidomainConfig: {
          "example.com": { lockPageSlug: "/maintenance-example" },
          "other.com": { lockPageSlug: "/maintenance-other" },
        },
      }

      mockContext.request = new Request("https://example.com/page")
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
        middleware: { before: [], after: [] },
        multidomainConfig: {
          "example.com": { lockPageSlug: "/maintenance-example" },
          "other.com": { lockPageSlug: "/maintenance-other" },
        },
      }

      mockContext.request = new Request("https://other.com/page")
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
        middleware: { before: [], after: [] },
        multidomainConfig: {
          "example.com": { lockPageSlug: "/maintenance-example" },
        },
      }

      mockContext.request = new Request("https://unknown-domain.com/page")
      mockContext.hostname = "unknown-domain.com"

      const middleware = useAppwarden(inputWithMultidomain)
      await middleware(mockContext, mockNext)

      // checkLockStatus should NOT be called for unconfigured domains
      expect(checkLockStatus).not.toHaveBeenCalled()
    })

    it("should fall back to root lockPageSlug when multidomainConfig is not provided", async () => {
      const inputWithRootOnly: CloudflareConfigType = {
        debug: false,
        lockPageSlug: "/root-maintenance",
        appwardenApiToken: "test-token",
        middleware: { before: [], after: [] },
      }

      mockContext.request = new Request("https://any-domain.com/page")
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
        lockPageSlug: "/root-maintenance",
        appwardenApiToken: "test-token",
        middleware: { before: [], after: [] },
        multidomainConfig: {
          "example.com": { lockPageSlug: "/domain-specific-maintenance" },
        },
      }

      mockContext.request = new Request("https://example.com/page")
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
        lockPageSlug: "/root-maintenance",
        appwardenApiToken: "test-token",
        middleware: { before: [], after: [] },
        multidomainConfig: {
          "example.com": { lockPageSlug: "/domain-specific-maintenance" },
        },
      }

      mockContext.request = new Request("https://other-domain.com/page")
      mockContext.hostname = "other-domain.com"

      const middleware = useAppwarden(inputWithBoth)
      await middleware(mockContext, mockNext)

      expect(checkLockStatus).toHaveBeenCalled()
      const callArgs = vi.mocked(checkLockStatus).mock.calls[0][0]
      expect(callArgs.lockPageSlug).toBe("/root-maintenance")
    })
  })
})

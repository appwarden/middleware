import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_CACHE_KEY, APPWARDEN_USER_AGENT } from "../constants"
import {
  handleResetCache,
  isResetCacheRequest,
  maybeQuarantine,
} from "../handlers"
import { CloudflareConfigType } from "../schemas"
import { MiddlewareContext } from "../types"
import { renderLockPage } from "../utils"
import { store } from "../utils/cloudflare"
import { useAppwarden } from "./use-appwarden"

// Mock dependencies
vi.mock("../handlers", () => ({
  handleResetCache: vi.fn(),
  isResetCacheRequest: vi.fn(),
  maybeQuarantine: vi.fn(),
}))

vi.mock("../utils", () => ({
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
  renderLockPage: vi.fn(() => new Response("Locked page")),
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
      middleware: { before: [] },
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
    vi.mocked(maybeQuarantine).mockImplementation(async () => {})
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
    expect(maybeQuarantine).not.toHaveBeenCalled()
  })

  it("should not quarantine for non-HTML requests", async () => {
    // Set up a non-HTML response
    mockContext.response = new Response("Test response", {
      headers: { "Content-Type": "application/json" },
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(maybeQuarantine).not.toHaveBeenCalled()
  })

  it("should not quarantine for monitoring requests", async () => {
    // Set up a monitoring request
    mockContext.request = new Request("https://example.com", {
      headers: { "User-Agent": APPWARDEN_USER_AGENT },
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(maybeQuarantine).not.toHaveBeenCalled()
  })

  it("should call maybeQuarantine for HTML requests that are not monitoring requests", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    expect(maybeQuarantine).toHaveBeenCalledWith(
      expect.objectContaining({
        keyName: APPWARDEN_CACHE_KEY,
        request: mockContext.request,
        edgeCache: mockEdgeCache,
        provider: "cloudflare-cache",
        debug: mockInput.debug,
        lockPageSlug: mockInput.lockPageSlug,
        appwardenApiToken: mockInput.appwardenApiToken,
      }),
      expect.objectContaining({
        onLocked: expect.any(Function),
      }),
    )
  })

  it("should set the response to the lock page when onLocked is called", async () => {
    // Create a mock response for renderLockPage
    const mockLockPageResponse = new Response("Locked page")
    vi.mocked(renderLockPage).mockResolvedValue(mockLockPageResponse)

    // Capture the onLocked callback
    let onLockedCallback: () => Promise<void> = async () => {}

    vi.mocked(maybeQuarantine).mockImplementation(async (context, options) => {
      onLockedCallback = options.onLocked
    })

    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Call the onLocked callback
    await onLockedCallback()

    expect(renderLockPage).toHaveBeenCalled()
    expect(mockContext.response).toBe(mockLockPageResponse)
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

  it("should pass the correct context to maybeQuarantine", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Verify maybeQuarantine was called
    expect(maybeQuarantine).toHaveBeenCalled()

    // Get the first argument passed to maybeQuarantine
    const contextArg = vi.mocked(maybeQuarantine).mock.calls[0][0]

    // Verify the context properties
    expect(contextArg.keyName).toBe(APPWARDEN_CACHE_KEY)
    expect(contextArg.request).toBe(mockContext.request)
    expect(contextArg.edgeCache).toBe(mockEdgeCache)
    expect(contextArg.provider).toBe("cloudflare-cache")
    expect(contextArg.debug).toBe(mockInput.debug)
    expect(contextArg.lockPageSlug).toBe(mockInput.lockPageSlug)
    expect(contextArg.appwardenApiToken).toBe(mockInput.appwardenApiToken)

    // Verify the second argument has an onLocked function
    const optionsArg = vi.mocked(maybeQuarantine).mock.calls[0][1]
    expect(optionsArg).toHaveProperty("onLocked")
    expect(typeof optionsArg.onLocked).toBe("function")
  })

  it("should correctly wrap waitUntil in the context", async () => {
    const middleware = useAppwarden(mockInput)
    await middleware(mockContext, mockNext)

    // Extract the waitUntil function that was passed to maybeQuarantine
    const contextArg = vi.mocked(maybeQuarantine).mock.calls[0][0]
    const waitUntilFn = contextArg.waitUntil

    // Call the waitUntil function
    const testPromise = Promise.resolve()
    waitUntilFn(testPromise)

    // Verify that the original waitUntil was called with the same promise
    expect(mockContext.waitUntil).toHaveBeenCalledWith(testPromise)
  })
})

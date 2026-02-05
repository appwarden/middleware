import { NextFetchEvent, NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { checkLockStatus } from "../core"
import { handleResetCache, isResetCacheRequest } from "../handlers"
import { NextJsConfigFnOutputSchema } from "../schemas"
import { renderLockPage } from "../utils"
import { store } from "../utils/cloudflare"
import { appwardenOnPagesNextJs } from "./appwarden-on-pages-next-js"

// Mock dependencies
vi.mock("@cloudflare/next-on-pages", () => ({
  getRequestContext: vi.fn(() => ({
    env: {
      DEBUG: "true",
      LOCK_PAGE_SLUG: "/maintenance",
      APPWARDEN_API_TOKEN: "test-token",
    },
  })),
}))

vi.mock("../core", () => ({
  checkLockStatus: vi.fn(),
}))

vi.mock("../handlers", () => ({
  handleResetCache: vi.fn(),
  isResetCacheRequest: vi.fn(),
}))

vi.mock("../utils", () => ({
  debug: vi.fn(),
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
  renderLockPage: vi.fn(() => new Response("Locked page")),
  isHTMLRequest: vi.fn(
    (request: Request) =>
      request.headers.get("accept")?.includes("text/html") ?? false,
  ),
}))

vi.mock("../utils/cloudflare", () => ({
  store: {
    json: vi.fn(),
  },
}))

vi.mock("../schemas", () => ({
  NextJsConfigFnOutputSchema: {
    safeParse: vi.fn(),
  },
  LockValueType: {},
}))

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: "next" })),
    rewrite: vi.fn((url) => ({ type: "rewrite", url })),
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

describe("appwardenOnPagesNextJs", () => {
  let mockRequest: NextRequest
  let mockEvent: NextFetchEvent
  let mockInputFn: any
  let mockEdgeCache: ReturnType<typeof store.json>
  let mockCachesOpen: typeof caches.open

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup test data
    // Create a NextRequest-like object
    mockRequest = {
      url: "https://example.com",
      headers: new Headers({ accept: "text/html" }),
      nextUrl: new URL("https://example.com"),
      cookies: {
        get: vi.fn(),
        getAll: vi.fn(),
        has: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      },
      method: "GET",
      clone: () => mockRequest,
      body: null,
      bodyUsed: false,
      cache: "default",
      credentials: "same-origin",
      destination: "document",
      integrity: "",
      keepalive: false,
      mode: "cors",
      redirect: "follow",
      referrer: "",
      referrerPolicy: "no-referrer",
      signal: new AbortController().signal,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    } as unknown as NextRequest

    mockEvent = {
      waitUntil: vi.fn(),
      sourcePage: { route: "/" },
      request: mockRequest,
      respondWith: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as NextFetchEvent

    mockInputFn = vi.fn((context) => ({
      debug: context.env.DEBUG === "true",
      lockPageSlug: context.env.LOCK_PAGE_SLUG,
      appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
    }))

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
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })
    vi.mocked(NextJsConfigFnOutputSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })
  })

  it("should return NextResponse.next() when config validation fails", async () => {
    // Mock validation failure
    vi.mocked(NextJsConfigFnOutputSchema.safeParse).mockReturnValueOnce({
      success: false,
      error: new ZodError([
        {
          code: "custom",
          path: ["appwardenApiToken"],
          message: "Invalid config",
        },
      ]),
    } as any)

    const middleware = appwardenOnPagesNextJs(mockInputFn)
    const result = await middleware(mockRequest, mockEvent)

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it("should handle reset cache requests", async () => {
    // Mock reset cache request
    vi.mocked(isResetCacheRequest).mockReturnValueOnce(true)

    const middleware = appwardenOnPagesNextJs(mockInputFn)
    await middleware(mockRequest, mockEvent)

    expect(handleResetCache).toHaveBeenCalledWith(
      APPWARDEN_CACHE_KEY,
      "cloudflare-cache",
      mockEdgeCache,
      mockRequest,
    )
  })

  it("should ignore non-HTML requests", async () => {
    // Create a non-HTML request
    const nonHtmlRequest = {
      ...mockRequest,
      headers: new Headers({ accept: "application/json" }),
    } as NextRequest

    const middleware = appwardenOnPagesNextJs(mockInputFn)
    await middleware(nonHtmlRequest, mockEvent)

    // checkLockStatus should not be called for non-HTML requests
    expect(checkLockStatus).not.toHaveBeenCalled()
  })

  it("should call checkLockStatus for HTML requests", async () => {
    const middleware = appwardenOnPagesNextJs(mockInputFn)
    await middleware(mockRequest, mockEvent)

    expect(checkLockStatus).toHaveBeenCalledWith({
      request: mockRequest,
      appwardenApiToken: "test-token",
      appwardenApiHostname: undefined,
      debug: true,
      lockPageSlug: "/maintenance",
      waitUntil: expect.any(Function),
    })
  })

  it("should render lock page when site is locked", async () => {
    // Mock checkLockStatus to return locked
    vi.mocked(checkLockStatus).mockResolvedValueOnce({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = appwardenOnPagesNextJs(mockInputFn)
    const result = await middleware(mockRequest, mockEvent)

    expect(renderLockPage).toHaveBeenCalled()
    // Just check that we got a Response object back
    expect(result).toBeInstanceOf(Response)
  })

  it("should handle errors gracefully", async () => {
    // Mock checkLockStatus to throw an error
    vi.mocked(checkLockStatus).mockRejectedValueOnce(new Error("Test error"))

    const middleware = appwardenOnPagesNextJs(mockInputFn)
    await middleware(mockRequest, mockEvent)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Test error"),
    )
  })
})

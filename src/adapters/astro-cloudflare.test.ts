import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_USER_AGENT } from "../constants"
import { checkLockStatus } from "../core"
import {
  AstroCloudflareRuntime,
  AstroMiddlewareContext,
  createAppwardenMiddleware,
} from "./astro-cloudflare"

// Mock dependencies
vi.mock("../core", () => ({
  checkLockStatus: vi.fn(),
}))

vi.mock("../utils", () => ({
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
  isMonitoringRequest: vi.fn(
    (request: Request) =>
      request.headers.get("User-Agent") === APPWARDEN_USER_AGENT,
  ),
  isHTMLRequest: vi.fn(
    (request: Request) =>
      request.headers.get("accept")?.includes("text/html") ?? false,
  ),
  createRedirect: vi.fn((url: URL) => {
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    })
  }),
  buildLockPageUrl: vi.fn((slug: string, requestUrl: string) => {
    const url = new URL(requestUrl)
    url.pathname = slug.startsWith("/") ? slug : `/${slug}`
    return url
  }),
  validateConfig: vi.fn(() => false), // No validation errors by default
  TEMPORARY_REDIRECT_STATUS: 302,
}))

// Mock console.error
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe("createAppwardenMiddleware (Astro)", () => {
  let mockRuntime: AstroCloudflareRuntime
  let mockContext: AstroMiddlewareContext
  let mockNext: () => Promise<Response>

  beforeEach(() => {
    vi.clearAllMocks()

    mockRuntime = {
      env: {
        APPWARDEN_API_TOKEN: "test-token",
        LOCK_PAGE_SLUG: "/maintenance",
      } as unknown as CloudflareEnv,
      ctx: {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      } as unknown as ExecutionContext,
    }

    mockContext = {
      // Default request accepts HTML
      request: new Request("https://example.com/page", {
        headers: { Accept: "text/html,application/xhtml+xml" },
      }),
      locals: {
        runtime: mockRuntime,
      },
      redirect: vi.fn((path: string, status?: number) => {
        return new Response(null, {
          status: status ?? 302,
          headers: { Location: path },
        })
      }),
    }

    mockNext = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }))

    // Default: site is not locked
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should call next() when site is not locked", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should redirect when site is locked", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(mockContext.redirect).toHaveBeenCalledWith(
      "https://example.com/maintenance",
      302,
    )
    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should normalize lock page slug to start with /", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "maintenance", // No leading slash
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(mockContext.redirect).toHaveBeenCalledWith(
      "https://example.com/maintenance",
      302,
    )
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should skip monitoring requests from Appwarden", async () => {
    mockContext.request = new Request("https://example.com/page", {
      headers: { "User-Agent": APPWARDEN_USER_AGENT },
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockContext, mockNext)

    expect(checkLockStatus).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
  })

  it("should skip non-HTML requests", async () => {
    // Request without text/html in Accept header (e.g., API call)
    mockContext.request = new Request("https://example.com/api/data", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockContext, mockNext)

    expect(checkLockStatus).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
  })

  it("should call next() when runtime is missing", async () => {
    mockContext.locals = {}

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockContext, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Cloudflare runtime not found"),
    )
    expect(mockNext).toHaveBeenCalled()
  })

  it("should pass correct config to checkLockStatus", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://custom-api.appwarden.io",
      debug: true,
    }))

    await middleware(mockContext, mockNext)

    expect(checkLockStatus).toHaveBeenCalledWith({
      request: mockContext.request,
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://custom-api.appwarden.io",
      debug: true,
      lockPageSlug: "/maintenance",
      waitUntil: expect.any(Function),
    })
  })

  it("should pass waitUntil function from runtime context", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockContext, mockNext)

    // Get the waitUntil function that was passed to checkLockStatus
    const checkLockStatusCall = vi.mocked(checkLockStatus).mock.calls[0][0]
    const waitUntilFn = checkLockStatusCall.waitUntil

    // Call the waitUntil function
    const testPromise = Promise.resolve()
    waitUntilFn!(testPromise)

    // Verify that the runtime ctx.waitUntil was called
    expect(mockRuntime.ctx.waitUntil).toHaveBeenCalledWith(testPromise)
  })

  it("should receive config from configFn with runtime context", async () => {
    const configFn = vi.fn().mockReturnValue({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    })

    const middleware = createAppwardenMiddleware(configFn)
    await middleware(mockContext, mockNext)

    expect(configFn).toHaveBeenCalledWith(mockRuntime)
  })

  it("should handle errors gracefully and call next()", async () => {
    vi.mocked(checkLockStatus).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in Appwarden middleware"),
    )
    expect(mockNext).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should use 302 status code for redirects (temporary redirect)", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(result.status).toBe(302)
  })

  it("should re-throw Response errors (redirects)", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { Location: "/other-page" },
    })
    vi.mocked(checkLockStatus).mockRejectedValue(redirectResponse)

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await expect(middleware(mockContext, mockNext)).rejects.toBe(
      redirectResponse,
    )
  })

  it("should fallback to createRedirect when context.redirect is not a function", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    // Remove the redirect function
    mockContext.redirect = undefined as unknown as (
      path: string,
      status?: number,
    ) => Response

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should handle test lock correctly", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: true,
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockContext, mockNext)

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })
})

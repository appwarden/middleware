import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkLockStatus } from "../core"
import {
  CloudflareContext,
  createAppwardenMiddleware,
  ReactRouterMiddlewareArgs,
} from "./react-router-cloudflare"

// Mock dependencies
vi.mock("../core", () => ({
  checkLockStatus: vi.fn(),
}))

vi.mock("../utils", () => ({
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
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

describe("createAppwardenMiddleware", () => {
  let mockCloudflareContext: CloudflareContext
  let mockArgs: ReactRouterMiddlewareArgs
  let mockNext: () => Promise<unknown>

  beforeEach(() => {
    vi.clearAllMocks()

    mockCloudflareContext = {
      env: {
        APPWARDEN_API_TOKEN: "test-token",
        LOCK_PAGE_SLUG: "/maintenance",
      } as unknown as CloudflareEnv,
      ctx: {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      } as unknown as ExecutionContext,
    }

    mockArgs = {
      // Default request accepts HTML
      request: new Request("https://example.com/page", {
        headers: { Accept: "text/html,application/xhtml+xml" },
      }),
      params: {},
      context: {
        cloudflare: mockCloudflareContext,
      },
    }

    mockNext = vi.fn().mockResolvedValue({ status: 200 })

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

    const result = await middleware(mockArgs, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })

  it("should call next() when config validation fails (fail open)", async () => {
    const { validateConfig } = await import("../utils")
    vi.mocked(validateConfig).mockReturnValue(true) // Config has errors

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(validateConfig).toHaveBeenCalled()
    expect(checkLockStatus).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })

  it("should throw a redirect response when site is locked", async () => {
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: true,
      isTestLock: false,
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await expect(middleware(mockArgs, mockNext)).rejects.toBeInstanceOf(
      Response,
    )

    try {
      await middleware(mockArgs, mockNext)
    } catch (error) {
      expect(error).toBeInstanceOf(Response)
      const response = error as Response
      expect(response.status).toBe(302)
      expect(response.headers.get("Location")).toBe(
        "https://example.com/maintenance",
      )
    }
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

    try {
      await middleware(mockArgs, mockNext)
    } catch (error) {
      const response = error as Response
      expect(response.headers.get("Location")).toBe(
        "https://example.com/maintenance",
      )
    }
  })

  it("should skip non-HTML requests", async () => {
    // Request without text/html in Accept header (e.g., API call)
    mockArgs.request = new Request("https://example.com/api/data", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockArgs, mockNext)

    expect(checkLockStatus).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
  })

  it("should call next() when cloudflare context is missing", async () => {
    mockArgs.context = {} as any

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockArgs, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Cloudflare context not found"),
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

    await middleware(mockArgs, mockNext)

    expect(checkLockStatus).toHaveBeenCalledWith({
      request: mockArgs.request,
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://custom-api.appwarden.io",
      debug: true,
      lockPageSlug: "/maintenance",
      waitUntil: expect.any(Function),
    })
  })

  it("should pass waitUntil function from cloudflare context", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockArgs, mockNext)

    // Get the waitUntil function that was passed to checkLockStatus
    const checkLockStatusCall = vi.mocked(checkLockStatus).mock.calls[0][0]
    const waitUntilFn = checkLockStatusCall.waitUntil

    // Call the waitUntil function
    const testPromise = Promise.resolve()
    waitUntilFn!(testPromise)

    // Verify that the cloudflare ctx.waitUntil was called
    expect(mockCloudflareContext.ctx.waitUntil).toHaveBeenCalledWith(
      testPromise,
    )
  })

  it("should receive config from configFn with cloudflare context", async () => {
    const configFn = vi.fn().mockReturnValue({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    })

    const middleware = createAppwardenMiddleware(configFn)
    await middleware(mockArgs, mockNext)

    expect(configFn).toHaveBeenCalledWith(mockCloudflareContext)
  })

  it("should handle errors gracefully and call next()", async () => {
    vi.mocked(checkLockStatus).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in Appwarden middleware"),
    )
    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
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

    await expect(middleware(mockArgs, mockNext)).rejects.toBe(redirectResponse)
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

    try {
      await middleware(mockArgs, mockNext)
    } catch (error) {
      const response = error as Response
      expect(response.status).toBe(302)
    }
  })
})

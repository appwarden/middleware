import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPWARDEN_USER_AGENT } from "../constants"
import { checkLockStatus } from "../core"
import {
  createAppwardenMiddleware,
  NextJsCloudflareRuntime,
} from "./nextjs-cloudflare"

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

// Mock next/server
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: "next", status: 200 })),
    redirect: vi.fn((url: URL, status: number) => ({
      type: "redirect",
      status,
      url: url.toString(),
      headers: new Headers({ Location: url.pathname }),
    })),
  },
}))

// Mock @opennextjs/cloudflare
const mockGetCloudflareContext = vi.fn()
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => mockGetCloudflareContext(),
}))

// Mock console.error
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe("createAppwardenMiddleware (OpenNext Cloudflare)", () => {
  let mockRuntime: NextJsCloudflareRuntime
  let mockRequest: Request

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

    mockGetCloudflareContext.mockResolvedValue(mockRuntime)

    // Default request accepts HTML
    mockRequest = new Request("https://example.com/page", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    // Default: site is not locked
    vi.mocked(checkLockStatus).mockResolvedValue({
      isLocked: false,
      isTestLock: false,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should return NextResponse.next() when site is not locked", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockRequest as any)

    expect(result.type).toBe("next")
  })

  it("should return NextResponse.next() when config validation fails (fail open)", async () => {
    const { validateConfig } = await import("../utils")
    vi.mocked(validateConfig).mockReturnValue(true) // Config has errors

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockRequest as any)

    expect(validateConfig).toHaveBeenCalled()
    expect(checkLockStatus).not.toHaveBeenCalled()
    expect(result.type).toBe("next")
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

    const result = await middleware(mockRequest as any)

    expect(result.type).toBe("redirect")
    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe("/maintenance")
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

    const result = await middleware(mockRequest as any)

    expect(result.headers.get("Location")).toBe("/maintenance")
  })

  it("should skip monitoring requests from Appwarden", async () => {
    mockRequest = new Request("https://example.com/page", {
      headers: { "User-Agent": APPWARDEN_USER_AGENT },
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    await middleware(mockRequest as any)

    expect(checkLockStatus).not.toHaveBeenCalled()
  })

  it("should skip non-HTML requests", async () => {
    // Request without text/html in Accept header (e.g., API call)
    mockRequest = new Request("https://example.com/api/data", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockRequest as any)

    expect(checkLockStatus).not.toHaveBeenCalled()
    expect(result.type).toBe("next")
  })

  it("should pass correct config to checkLockStatus", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://custom-api.appwarden.io",
      debug: true,
    }))

    await middleware(mockRequest as any)

    expect(checkLockStatus).toHaveBeenCalledWith({
      request: mockRequest,
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

    await middleware(mockRequest as any)

    // Get the waitUntil function that was passed to checkLockStatus
    const checkLockStatusCall = vi.mocked(checkLockStatus).mock.calls[0][0]
    const waitUntilFn = checkLockStatusCall.waitUntil

    // Call the waitUntil function
    const testPromise = Promise.resolve()
    waitUntilFn!(testPromise)

    // Verify that the cloudflare ctx.waitUntil was called
    expect(mockRuntime.ctx.waitUntil).toHaveBeenCalledWith(testPromise)
  })

  it("should receive config from configFn with runtime context", async () => {
    const configFn = vi.fn().mockReturnValue({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    })

    const middleware = createAppwardenMiddleware(configFn)
    await middleware(mockRequest as any)

    expect(configFn).toHaveBeenCalledWith(mockRuntime)
  })

  it("should handle errors gracefully and return NextResponse.next()", async () => {
    vi.mocked(checkLockStatus).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockRequest as any)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in Appwarden middleware"),
    )
    expect(result.type).toBe("next")
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

    const result = await middleware(mockRequest as any)

    expect(result.status).toBe(302)
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

    const result = await middleware(mockRequest as any)

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe("/maintenance")
  })

  it("should handle getCloudflareContext errors gracefully", async () => {
    mockGetCloudflareContext.mockRejectedValue(
      new Error("Cloudflare context unavailable"),
    )

    const middleware = createAppwardenMiddleware(() => ({
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockRequest as any)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in Appwarden middleware"),
    )
    expect(result.type).toBe("next")
  })
})

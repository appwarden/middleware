import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import type { HeartbeatResponseBody } from "../types"
import * as utils from "../utils"
import { resolveAdapterAction } from "../utils/adapter-common"
import {
  createAppwardenMiddleware,
  NextJsCloudflareRuntime,
} from "./nextjs-cloudflare"

type MockedNextResponse = Response & {
  mockType?: "next" | "redirect"
  mockUrl?: string
}

const asMockedNextResponse = (response: Response): MockedNextResponse =>
  response as MockedNextResponse

// Mock dependencies
vi.mock("../utils/adapter-common", () => ({
  resolveAdapterAction: vi.fn(),
}))

vi.mock("../utils", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("../utils")
  return {
    ...actual,
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
    isOnLockPage: vi.fn((slug: string, requestUrl: string) => {
      const normalizedSlug = slug.startsWith("/") ? slug : `/${slug}`
      const url = new URL(requestUrl)
      return url.pathname === normalizedSlug
    }),
    validateConfig: vi.fn(() => false), // No validation errors by default
    TEMPORARY_REDIRECT_STATUS: 302,
  }
})

vi.mock("next/server", () => {
  class MockNextResponse extends Response {
    static next = vi.fn(() => {
      const response = new MockNextResponse(null, {
        status: 200,
      }) as MockedNextResponse
      response.mockType = "next"
      return response
    })

    static redirect = vi.fn((url: string | URL, status = 302) => {
      const targetUrl = url instanceof URL ? url : new URL(url)
      const response = new MockNextResponse(null, {
        status,
        headers: { Location: targetUrl.pathname },
      }) as MockedNextResponse

      response.mockType = "redirect"
      response.mockUrl = targetUrl.toString()
      return response
    })
  }

  return {
    NextResponse: MockNextResponse,
  }
})

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
        APPWARDEN_API_TOKEN:
          "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        APPWARDEN_LOCK_PAGE_SLUG: "/maintenance",
      } as unknown as CloudflareEnv,
      ctx: {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      } as unknown as ExecutionContext,
    }

    mockGetCloudflareContext.mockReturnValue(mockRuntime)

    mockRequest = new Request("https://example.com/page", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    // Default: website is not locked
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-unlocked",
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should return NextResponse.next() when site is not locked", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(asMockedNextResponse(result).mockType).toBe("next")
  })

  it("should return NextResponse.next() when config validation fails (fail open)", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "", // Invalid - empty token
    }))

    const result = await middleware(mockRequest as any)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Config validation failed"),
    )
    expect(resolveAdapterAction).not.toHaveBeenCalled()
    expect(asMockedNextResponse(result).mockType).toBe("next")

    consoleErrorSpy.mockRestore()
  })

  it("should redirect when site is locked", async () => {
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-locked",
      lockPageUrl: new URL("https://example.com/maintenance"),
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(asMockedNextResponse(result).mockType).toBe("redirect")
    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe("/maintenance")
  })

  it("should normalize lock page slug to start with /", async () => {
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-locked",
      lockPageUrl: new URL("https://example.com/maintenance"),
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "maintenance" }, // No leading slash
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(result.headers.get("Location")).toBe("/maintenance")
  })

  it("should skip non-HTML requests", async () => {
    mockRequest = new Request("https://example.com/api/data", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(resolveAdapterAction).toHaveBeenCalled()
    expect(asMockedNextResponse(result).mockType).toBe("next")
  })

  it("should pass correct config to resolveAdapterAction", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
      appwardenApiHostname: "https://api.appwarden.io",
      debug: true,
    }))

    await middleware(mockRequest as any)

    expect(resolveAdapterAction).toHaveBeenCalledWith(
      mockRequest,
      expect.objectContaining({
        appwardenApiToken:
          "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        appwardenApiHostname: "https://api.appwarden.io",
        debug: true,
        website: expect.objectContaining({ lockPageSlug: "/maintenance" }),
        api: expect.objectContaining({ basePaths: ["/api"] }),
        bypassPaths: ["/health"],
      }),
      expect.any(Function),
    )
  })

  it("should use ctx.waitUntil from ExecutionContext in resolveAdapterAction config", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    await middleware(mockRequest as any)

    const resolveAdapterActionCall =
      vi.mocked(resolveAdapterAction).mock.calls[0]
    const waitUntilFn = resolveAdapterActionCall[2]

    const testPromise = Promise.resolve()
    waitUntilFn(testPromise)

    expect(mockRuntime.ctx.waitUntil).toHaveBeenCalledWith(testPromise)
  })

  it("should receive config from configFn with runtime context", async () => {
    const configFn = vi.fn().mockReturnValue({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    })

    const middleware = createAppwardenMiddleware(configFn)
    await middleware(mockRequest as any)

    expect(configFn).toHaveBeenCalledWith(mockRuntime)
  })

  it("should handle errors gracefully and return NextResponse.next()", async () => {
    vi.mocked(resolveAdapterAction).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled error:"),
    )
    expect(asMockedNextResponse(result).mockType).toBe("next")
  })

  it("should use 302 status code for redirects (temporary redirect)", async () => {
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-locked",
      lockPageUrl: new URL("https://example.com/maintenance"),
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(result.status).toBe(302)
  })

  it("should handle test lock correctly", async () => {
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-locked",
      lockPageUrl: new URL("https://example.com/maintenance"),
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe("/maintenance")
  })

  it("should handle getCloudflareContext errors gracefully", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("Cloudflare context unavailable")
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled error:"),
    )
    expect(asMockedNextResponse(result).mockType).toBe("next")
  })

  it("should return a heartbeat config error when Cloudflare context is unavailable", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("Cloudflare context unavailable")
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["context"],
        code: "custom",
        message: "Cloudflare context unavailable",
      },
    ])
  })

  it("should return a heartbeat config error when config evaluation throws", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => {
      throw new Error("boom")
    })

    const result = await middleware(mockRequest as any)
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["config"],
        code: "custom",
        message: "Appwarden config evaluation failed",
      },
    ])
  })

  it("should return sanitized heartbeat config errors when config evaluation throws a ZodError", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => {
      throw new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["appwardenApiToken"],
          message: "Required",
        },
      ])
    })

    const result = await middleware(mockRequest as any)
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["appwardenApiToken"],
        code: "invalid_type",
        message:
          "APPWARDEN_API_TOKEN is missing or empty. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      },
    ])
  })

  it("should return a granular heartbeat error for an empty appwardenApiToken", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "",
    }))

    const result = await middleware(mockRequest as any)
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["appwardenApiToken"],
        code: "custom",
        message:
          "APPWARDEN_API_TOKEN is missing or empty. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      },
      {
        path: ["appwardenApiToken"],
        code: "custom",
        message:
          "APPWARDEN_API_TOKEN is not a valid dual-token (expected format: aw_<publicId>_<secret>).",
      },
    ])
  })

  it("should return a granular heartbeat error for CSP directives containing {{nonce}}", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: {
        lockPageSlug: "/maintenance",
        cspMode: "enforced",
        cspDirectives: {
          "script-src": ["'self'", "{{nonce}}"],
        },
      },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["website", "cspDirectives"],
        code: "custom",
        message:
          "Nonce-based CSP is not supported in the Next.js Cloudflare adapter. Remove '{{nonce}}' placeholders from your CSP directives, as this adapter does not inject nonces into HTML.",
      },
    ])
  })

  it("should keep heartbeat deterministic when heartbeat sanitization throws", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })
    vi.spyOn(utils, "sanitizeConfigErrors").mockImplementation(() => {
      throw new Error("boom")
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "",
    }))

    const result = await middleware(mockRequest as any)
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["config"],
        code: "custom",
        message: "Appwarden config evaluation failed",
      },
    ])
  })

  it("should pass through non-GET heartbeat requests via normal non-HTML flow", async () => {
    mockRequest = new Request("https://example.com/_appwarden/heartbeat", {
      method: "POST",
      headers: { Accept: "application/json" },
    })

    const configFn = vi.fn(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))
    const middleware = createAppwardenMiddleware(configFn)

    const result = await middleware(mockRequest as any)

    expect(result.status).toBe(200)
    expect(asMockedNextResponse(result).mockType).toBe("next")
    expect(configFn).toHaveBeenCalledTimes(1)
    expect(mockGetCloudflareContext).toHaveBeenCalledTimes(1)
    expect(resolveAdapterAction).toHaveBeenCalled()
  })

  it("should not redirect when already on lock page to prevent infinite redirect loop", async () => {
    mockRequest = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(resolveAdapterAction).toHaveBeenCalled()
    expect(asMockedNextResponse(result).mockType).toBe("next")
  })

  it("should not redirect when already on lock page (slug without leading slash)", async () => {
    mockRequest = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "maintenance" }, // No leading slash
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken:
        "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    }))

    const result = await middleware(mockRequest as any)

    expect(resolveAdapterAction).toHaveBeenCalled()
    expect(asMockedNextResponse(result).mockType).toBe("next")
  })
})

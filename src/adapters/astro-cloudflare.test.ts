import type { APIContext } from "astro"
import { waitUntil } from "cloudflare:workers"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import type { HeartbeatResponseBody } from "../types"
import * as utils from "../utils"
import { resolveAdapterAction } from "../utils/adapter-common"
import { applyContentSecurityPolicyToResponse } from "../utils/apply-content-security-policy-to-response"
import {
  AstroCloudflareRuntime,
  createAppwardenMiddleware,
} from "./astro-cloudflare"

const { mockCloudflareEnv, mockCaches } = vi.hoisted(() => ({
  mockCloudflareEnv: {
    APPWARDEN_API_TOKEN: "test-token",
    APPWARDEN_LOCK_PAGE_SLUG: "/maintenance",
    APPWARDEN_API_HOSTNAME: "https://staging-api.appwarden.io",
    CSP_MODE: "report-only",
    CSP_DIRECTIVES: '{ "default-src": ["{{nonce}}"] }',
    DEBUG: true,
  } as unknown as CloudflareEnv,
  mockCaches: {} as CacheStorage,
}))

// Mock cloudflare:workers exports used by the adapter
vi.mock("cloudflare:workers", () => ({
  env: mockCloudflareEnv,
  waitUntil: vi.fn(),
}))

/**
 * Mock Astro middleware context interface for testing.
 */
interface MockAstroContext {
  request: Request
  locals: {
    cfContext?: ExecutionContext
    [key: string]: unknown
  }
  redirect: (path: string, status?: number) => Response
}

const asAPIContext = (ctx: MockAstroContext): APIContext =>
  ctx as unknown as APIContext

const asResponse = (result: Response | void): Response => {
  expect(result).toBeInstanceOf(Response)
  return result as Response
}

// Mock dependencies
vi.mock("../utils/adapter-common", () => ({
  resolveAdapterAction: vi.fn(),
}))

vi.mock(
  "../utils/apply-content-security-policy-to-response",
  async (importOriginal) => {
    const actual =
      (await importOriginal()) as typeof import("../utils/apply-content-security-policy-to-response")
    return {
      ...actual,
      applyContentSecurityPolicyToResponse: vi.fn(
        actual.applyContentSecurityPolicyToResponse,
      ),
    }
  },
)

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
    validateConfig: vi.fn(() => false),
    TEMPORARY_REDIRECT_STATUS: 302,
  }
})

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
  let mockContext: MockAstroContext
  let mockNext: () => Promise<Response>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("caches", mockCaches)

    mockRuntime = {
      env: mockCloudflareEnv,
      caches: mockCaches,
      ctx: {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      } as unknown as ExecutionContext,
    } as unknown as AstroCloudflareRuntime

    mockContext = {
      request: new Request("https://example.com/page", {
        headers: { Accept: "text/html,application/xhtml+xml" },
      }),
      locals: {
        cfContext: mockRuntime.ctx,
      },
      redirect: vi.fn((path: string, status?: number) => {
        return new Response(null, {
          status: status ?? 302,
          headers: { Location: path },
        })
      }),
    }

    mockNext = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }))

    // Default: website is not locked
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-unlocked",
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it("should call next() when site is not locked", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(mockNext).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should call next() when config validation fails (fail open)", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "", // Invalid - empty token
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Config validation failed"),
    )
    expect(resolveAdapterAction).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
    expect(result.status).toBe(200)

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
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

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
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-locked",
      lockPageUrl: new URL("https://example.com/maintenance"),
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "maintenance" }, // No leading slash
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(mockContext.redirect).toHaveBeenCalledWith(
      "https://example.com/maintenance",
      302,
    )
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should skip non-HTML requests", async () => {
    mockContext.request = new Request("https://example.com/api/data", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    await middleware(asAPIContext(mockContext), mockNext)

    expect(resolveAdapterAction).toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
  })

  it("should call next() when runtime is missing", async () => {
    mockContext.locals = {}

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    await middleware(asAPIContext(mockContext), mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Cloudflare context not found"),
    )
    expect(mockNext).toHaveBeenCalled()
  })

  it("should return a heartbeat config error when runtime is missing", async () => {
    mockContext.request = new Request(
      "https://example.com/_appwarden/heartbeat",
      { headers: { Accept: "application/json" } },
    )
    mockContext.locals = {}

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["runtime"],
        code: "custom",
        message: "Cloudflare runtime unavailable",
      },
    ])
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should return a controlled heartbeat error when config evaluation throws", async () => {
    mockContext.request = new Request(
      "https://example.com/_appwarden/heartbeat",
      { headers: { Accept: "application/json" } },
    )

    const middleware = createAppwardenMiddleware(() => {
      throw new Error("boom")
    })

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["config"],
        code: "custom",
        message: "Appwarden config evaluation failed",
      },
    ])
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should return sanitized heartbeat config errors when config evaluation throws a ZodError", async () => {
    mockContext.request = new Request(
      "https://example.com/_appwarden/heartbeat",
      { headers: { Accept: "application/json" } },
    )

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

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )
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
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should keep heartbeat deterministic when heartbeat sanitization throws", async () => {
    mockContext.request = new Request(
      "https://example.com/_appwarden/heartbeat",
      { headers: { Accept: "application/json" } },
    )
    vi.spyOn(utils, "sanitizeConfigErrors").mockImplementation(() => {
      throw new Error("boom")
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )
    const body = (await result.json()) as HeartbeatResponseBody

    expect(result.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["config"],
        code: "custom",
        message: "Appwarden config evaluation failed",
      },
    ])
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should pass through non-GET heartbeat requests via normal non-HTML flow", async () => {
    mockContext.request = new Request(
      "https://example.com/_appwarden/heartbeat",
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
    )

    const configFn = vi.fn(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))
    const middleware = createAppwardenMiddleware(configFn)

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(result.status).toBe(200)
    expect(configFn).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(resolveAdapterAction).toHaveBeenCalled()
  })

  it("should pass correct config to resolveAdapterAction", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://api.appwarden.io",
      debug: true,
    }))

    await middleware(asAPIContext(mockContext), mockNext)

    expect(resolveAdapterAction).toHaveBeenCalledWith(
      mockContext.request,
      expect.objectContaining({
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        debug: true,
        website: expect.objectContaining({ lockPageSlug: "/maintenance" }),
        api: expect.objectContaining({ basePaths: ["/api"] }),
        bypassPaths: ["/health"],
      }),
      waitUntil,
    )
  })

  it("should use waitUntil from cloudflare:workers in resolveAdapterAction config", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    await middleware(asAPIContext(mockContext), mockNext)

    const resolveAdapterActionCall =
      vi.mocked(resolveAdapterAction).mock.calls[0]
    const waitUntilFn = resolveAdapterActionCall[2]

    expect(waitUntilFn).toBe(waitUntil)
  })

  it("should receive config from configFn with runtime context", async () => {
    const configFn = vi.fn().mockReturnValue({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    })

    const middleware = createAppwardenMiddleware(configFn)
    await middleware(asAPIContext(mockContext), mockNext)

    expect(configFn).toHaveBeenCalledWith(mockRuntime)
  })

  it("should handle errors gracefully and call next()", async () => {
    vi.mocked(resolveAdapterAction).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled error:"),
    )
    expect(mockNext).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should return the original response when CSP post-processing fails", async () => {
    const originalResponse = new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })
    mockNext = vi.fn().mockResolvedValue(originalResponse)
    vi.mocked(applyContentSecurityPolicyToResponse).mockRejectedValueOnce(
      new Error("CSP error"),
    )

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
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to apply content security policy:"),
    )
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(result).toBe(originalResponse)
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
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(result.status).toBe(302)
  })

  it("should re-throw Response errors (redirects)", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { Location: "/other-page" },
    })
    vi.mocked(resolveAdapterAction).mockRejectedValue(redirectResponse)

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    await expect(middleware(asAPIContext(mockContext), mockNext)).rejects.toBe(
      redirectResponse,
    )
  })

  it("should fallback to createRedirect when context.redirect is not a function", async () => {
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-locked",
      lockPageUrl: new URL("https://example.com/maintenance"),
    })

    mockContext.redirect = undefined as unknown as (
      path: string,
      status?: number,
    ) => Response

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
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
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(result.status).toBe(302)
    expect(result.headers.get("Location")).toBe(
      "https://example.com/maintenance",
    )
  })

  it("should not redirect when already on lock page to prevent infinite redirect loop", async () => {
    mockContext.request = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.redirect).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
  })

  it("should apply CSP when already on the lock page", async () => {
    mockContext.request = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })
    mockNext = vi.fn().mockResolvedValue(
      new Response("<html><body>Maintenance</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    )

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
      appwardenApiToken: "test-token",
    }))

    const response = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy()
  })

  it("should not redirect when already on lock page (slug without leading slash)", async () => {
    mockContext.request = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "maintenance" }, // No leading slash
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = asResponse(
      await middleware(asAPIContext(mockContext), mockNext),
    )

    expect(mockNext).toHaveBeenCalled()
    expect(result.status).toBe(200)
  })
})

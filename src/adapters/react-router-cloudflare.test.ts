import { waitUntil } from "cloudflare:workers"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import type { HeartbeatResponseBody } from "../types"
import * as utils from "../utils"
import { resolveAdapterAction } from "../utils/adapter-common"
import { applyContentSecurityPolicyToResponse } from "../utils/apply-content-security-policy-to-response"
import { createAppwardenMiddleware } from "./react-router-cloudflare"

// Mock cloudflare:workers module
vi.mock("cloudflare:workers", () => ({
  env: {
    APPWARDEN_API_TOKEN: "test-token",
    APPWARDEN_LOCK_PAGE_SLUG: "/maintenance",
  } as unknown as CloudflareEnv,
  waitUntil: vi.fn(),
}))

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
    validateConfig: vi.fn(() => false), // No validation errors by default
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

describe("createAppwardenMiddleware", () => {
  let mockArgs: {
    request: Request
    params: Record<string, string | undefined>
  }
  let mockNext: () => Promise<void | Response>

  beforeEach(() => {
    vi.clearAllMocks()

    mockArgs = {
      request: new Request("https://example.com/page", {
        headers: { Accept: "text/html,application/xhtml+xml" },
      }),
      params: {},
    }

    mockNext = vi.fn().mockResolvedValue({ status: 200 })

    // Default: website is not locked
    vi.mocked(resolveAdapterAction).mockResolvedValue({
      type: "website-unlocked",
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should call next() when site is not locked", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })

  it("should call next() when config validation fails (fail open)", async () => {
    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "", // Invalid - empty token
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Config validation failed"),
    )
    expect(resolveAdapterAction).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })

  it("should return a heartbeat response when config is valid", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)
    expect(result).toBeInstanceOf(Response)

    const response = result as Response
    const body = (await response.json()) as HeartbeatResponseBody

    expect(response.status).toBe(200)
    expect(body.service).toBe("cloudflare-react-router")
    expect(body.configErrors).toEqual([])
    expect(mockNext).not.toHaveBeenCalled()
    expect(resolveAdapterAction).not.toHaveBeenCalled()
  })

  it("should return heartbeat config errors when config validation fails", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "",
    }))

    const result = await middleware(mockArgs, mockNext)
    expect(result).toBeInstanceOf(Response)

    const response = result as Response
    const body = (await response.json()) as HeartbeatResponseBody

    expect(response.status).toBe(200)
    expect(body.configErrors).toHaveLength(1)
    expect(body.configErrors[0]).toMatchObject({
      path: expect.any(Array),
      code: expect.any(String),
      message: expect.any(String),
    })
    expect(mockNext).not.toHaveBeenCalled()
    expect(resolveAdapterAction).not.toHaveBeenCalled()
  })

  it("should return descriptive error when contentSecurityPolicy.mode is a number", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: {
        lockPageSlug: "/maintenance",
        cspMode: 2 as any, // Invalid: should be a string
        cspDirectives: {
          "script-src": ["self"],
        },
      },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "valid-token",
    }))

    const result = await middleware(mockArgs, mockNext)
    expect(result).toBeInstanceOf(Response)

    const response = result as Response
    const body = (await response.json()) as HeartbeatResponseBody

    expect(response.status).toBe(200)
    expect(body.configErrors.length).toBeGreaterThan(0)

    // Find the error for the cspMode field
    const modeError = body.configErrors.find((error) =>
      error.path.includes("cspMode"),
    )
    expect(modeError).toBeDefined()
    expect(modeError?.code).toBe("invalid_union")
    expect(modeError?.message).toBe(
      "Invalid type for cspMode. Expected disabled | report-only | enforced",
    )
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should return a controlled heartbeat error when config evaluation throws", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => {
      throw new Error("boom")
    })

    const result = await middleware(mockArgs, mockNext)
    expect(result).toBeInstanceOf(Response)

    const response = result as Response
    const body = (await response.json()) as HeartbeatResponseBody

    expect(response.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["config"],
        code: "custom",
        message: "Appwarden config evaluation failed",
      },
    ])
    expect(mockNext).not.toHaveBeenCalled()
    expect(resolveAdapterAction).not.toHaveBeenCalled()
  })

  it("should return sanitized heartbeat config errors when config evaluation throws a ZodError", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
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

    const result = await middleware(mockArgs, mockNext)
    expect(result).toBeInstanceOf(Response)

    const response = result as Response
    const body = (await response.json()) as HeartbeatResponseBody

    expect(response.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["appwardenApiToken"],
        code: "invalid_type",
        message:
          "APPWARDEN_API_TOKEN is missing or empty. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      },
    ])
    expect(mockNext).not.toHaveBeenCalled()
    expect(resolveAdapterAction).not.toHaveBeenCalled()
  })

  it("should keep heartbeat deterministic when heartbeat sanitization throws", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
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

    const result = await middleware(mockArgs, mockNext)
    expect(result).toBeInstanceOf(Response)

    const response = result as Response
    const body = (await response.json()) as HeartbeatResponseBody

    expect(response.status).toBe(200)
    expect(body.configErrors).toEqual([
      {
        path: ["config"],
        code: "custom",
        message: "Appwarden config evaluation failed",
      },
    ])
    expect(mockNext).not.toHaveBeenCalled()
    expect(resolveAdapterAction).not.toHaveBeenCalled()
  })

  it("should pass through non-GET heartbeat requests via normal non-HTML flow", async () => {
    mockArgs.request = new Request("https://example.com/_appwarden/heartbeat", {
      method: "POST",
      headers: { Accept: "application/json" },
    })

    const configFn = vi.fn(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))
    const middleware = createAppwardenMiddleware(configFn)

    const result = await middleware(mockArgs, mockNext)
    expect(result).toEqual({ status: 200 })
    expect(configFn).toHaveBeenCalledTimes(1)
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(resolveAdapterAction).toHaveBeenCalled()
  })

  it("should throw a redirect response when site is locked", async () => {
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
    mockArgs.request = new Request("https://example.com/api/data", {
      headers: { Accept: "application/json" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    await middleware(mockArgs, mockNext)

    expect(resolveAdapterAction).toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
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

    await middleware(mockArgs, mockNext)

    expect(resolveAdapterAction).toHaveBeenCalledWith(
      mockArgs.request,
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

    await middleware(mockArgs, mockNext)

    const resolveAdapterActionCall =
      vi.mocked(resolveAdapterAction).mock.calls[0]
    const waitUntilFn = resolveAdapterActionCall[2]

    expect(waitUntilFn).toBe(waitUntil)
  })

  it("should receive config from configFn without parameters", async () => {
    const configFn = vi.fn().mockReturnValue({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    })

    const middleware = createAppwardenMiddleware(configFn)
    await middleware(mockArgs, mockNext)

    expect(configFn).toHaveBeenCalledWith()
  })

  it("should handle errors gracefully and call next()", async () => {
    vi.mocked(resolveAdapterAction).mockRejectedValue(new Error("API error"))

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled error:"),
    )
    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
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

    const result = await middleware(mockArgs, mockNext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to apply content security policy:"),
    )
    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(result).toBe(originalResponse)
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

    await expect(middleware(mockArgs, mockNext)).rejects.toBe(redirectResponse)
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

    try {
      await middleware(mockArgs, mockNext)
    } catch (error) {
      const response = error as Response
      expect(response.status).toBe(302)
    }
  })

  it("should not redirect when already on lock page to prevent infinite redirect loop", async () => {
    mockArgs.request = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })

  it("should apply CSP when already on the lock page", async () => {
    mockArgs.request = new Request("https://example.com/maintenance", {
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

    const response = (await middleware(mockArgs, mockNext)) as Response

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy()
  })

  it("should not redirect when already on lock page (slug without leading slash)", async () => {
    mockArgs.request = new Request("https://example.com/maintenance", {
      headers: { Accept: "text/html,application/xhtml+xml" },
    })

    const middleware = createAppwardenMiddleware(() => ({
      website: { lockPageSlug: "maintenance" }, // No leading slash
      api: { basePaths: ["/api"] },
      bypassPaths: ["/health"],
      appwardenApiToken: "test-token",
    }))

    const result = await middleware(mockArgs, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(result).toEqual({ status: 200 })
  })
})

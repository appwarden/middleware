import { NextFetchEvent, NextRequest, NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import {
  APPWARDEN_CACHE_KEY,
  APPWARDEN_USER_AGENT,
  globalErrors,
} from "../constants"
import { LockValueType } from "../schemas"
import { AppwardenConfigSchema } from "../schemas/vercel"
import {
  getErrors,
  handleVercelRequest,
  isCacheUrl,
  MemoryCache,
} from "../utils"
import { syncEdgeValue } from "../utils/vercel"
import { appwardenOnVercel } from "./appwarden-on-vercel"

// Mock dependencies
vi.mock("../utils", () => ({
  debug: vi.fn(),
  getErrors: vi.fn(() => ["Error message"]),
  handleVercelRequest: vi.fn(),
  isCacheUrl: {
    edgeConfig: vi.fn(),
    upstash: vi.fn(),
  },
  MemoryCache: vi.fn(),
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
}))

vi.mock("../utils/vercel", () => ({
  syncEdgeValue: vi.fn(),
}))

// Mock AppwardenConfigSchema
vi.mock("../schemas/vercel", () => ({
  AppwardenConfigSchema: {
    safeParse: vi.fn(),
  },
}))

// Mock NextResponse
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server")
  return {
    ...actual,
    NextResponse: {
      next: vi.fn(() => ({ type: "next" })),
      rewrite: vi.fn((url, options) => ({ type: "rewrite", url, options })),
    },
  }
})

describe("appwardenOnVercel", () => {
  let mockRequest: NextRequest
  let mockEvent: NextFetchEvent
  let mockMemoryCache: MemoryCache<string, LockValueType>
  let mockInputFn: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup test data
    mockRequest = {
      url: "https://example.com",
      headers: new Headers({
        accept: "text/html",
      }),
      nextUrl: {
        pathname: "/",
      },
    } as unknown as NextRequest

    mockEvent = {
      passThroughOnException: vi.fn(),
      waitUntil: vi.fn(),
    } as unknown as NextFetchEvent

    // Mock MemoryCache
    mockMemoryCache = {
      get: vi.fn(),
      put: vi.fn(),
      getValues: vi.fn(),
    } as unknown as MemoryCache<string, LockValueType>

    // Mock static method
    ;(MemoryCache as any).isExpired = vi.fn().mockReturnValue(false)

    // Mock constructor
    ;(MemoryCache as any).mockImplementation(() => mockMemoryCache)

    // Mock valid input function
    mockInputFn = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "test-token",
      vercelApiToken: "vercel-token",
      lockPageSlug: "/maintenance",
    }

    // Mock handleVercelRequest
    vi.mocked(handleVercelRequest).mockResolvedValue(undefined)

    // Mock isCacheUrl.edgeConfig
    vi.mocked(isCacheUrl.edgeConfig).mockReturnValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should pass through on exception", async () => {
    // Set up the mock to return success
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    const handler = appwardenOnVercel(mockInputFn)
    await handler(mockRequest, mockEvent)

    expect(mockEvent.passThroughOnException).toHaveBeenCalled()
  })

  it("should return NextResponse.next() when config validation fails", async () => {
    // Create a mock ZodError
    const mockZodError = new ZodError([])

    // Mock AppwardenConfigSchema.safeParse to fail
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: false,
      error: mockZodError,
    })

    const handler = appwardenOnVercel(mockInputFn)
    const result = await handler(mockRequest, mockEvent)

    expect(getErrors).toHaveBeenCalled()
    expect(NextResponse.next).toHaveBeenCalled()
    expect(result).toEqual({ type: "next" })
  })

  it("should ignore non-HTML requests", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Set up a non-HTML request
    mockRequest = {
      ...mockRequest,
      headers: new Headers({
        accept: "application/json",
      }),
    } as unknown as NextRequest

    const handler = appwardenOnVercel(mockInputFn)
    const result = await handler(mockRequest, mockEvent)

    expect(handleVercelRequest).not.toHaveBeenCalled()
    expect(NextResponse.next).toHaveBeenCalled()
    expect(result).toEqual({ type: "next" })
  })

  it("should ignore monitoring requests", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Set up a monitoring request
    mockRequest = {
      ...mockRequest,
      headers: new Headers({
        accept: "text/html",
        "User-Agent": APPWARDEN_USER_AGENT,
      }),
    } as unknown as NextRequest

    const handler = appwardenOnVercel(mockInputFn)
    const result = await handler(mockRequest, mockEvent)

    expect(handleVercelRequest).not.toHaveBeenCalled()
    expect(NextResponse.next).toHaveBeenCalled()
    expect(result).toEqual({ type: "next" })
  })

  it("should handle HTML requests and call handleVercelRequest", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    const handler = appwardenOnVercel(mockInputFn)
    await handler(mockRequest, mockEvent)

    expect(handleVercelRequest).toHaveBeenCalled()
    // Verify context passed to handleVercelRequest
    const context = vi.mocked(handleVercelRequest).mock.calls[0][0]
    expect(context.req).toBe(mockRequest)
    expect(context.event).toBe(mockEvent)
    expect(context.keyName).toBe(APPWARDEN_CACHE_KEY)
    expect(context.provider).toBe("edge-config")
    expect(context.cacheUrl).toBe(mockInputFn.cacheUrl)
    expect(context.appwardenApiToken).toBe(mockInputFn.appwardenApiToken)
  })

  it("should render lock page when handleVercelRequest calls onLocked", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Mock handleVercelRequest to call onLocked
    vi.mocked(handleVercelRequest).mockImplementation(
      async (_context, options) => {
        options.onLocked()
        return { isLocked: 1 } as LockValueType
      },
    )

    const handler = appwardenOnVercel(mockInputFn)
    const result = await handler(mockRequest, mockEvent)

    expect(handleVercelRequest).toHaveBeenCalled()
    expect(NextResponse.rewrite).toHaveBeenCalled()
    expect(result).toEqual({
      type: "rewrite",
      url: expect.objectContaining({
        pathname: "/maintenance",
      }),
      options: {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    })
  })

  it("should sync edge value when cache is expired", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Mock MemoryCache.isExpired to return true
    const originalIsExpired = (MemoryCache as any).isExpired
    ;(MemoryCache as any).isExpired = vi.fn().mockReturnValue(true)

    const handler = appwardenOnVercel(mockInputFn)
    await handler(mockRequest, mockEvent)

    expect(syncEdgeValue).toHaveBeenCalled()
    expect(mockEvent.waitUntil).toHaveBeenCalled()

    // Restore original
    ;(MemoryCache as any).isExpired = originalIsExpired
  })

  it("should handle errors and return NextResponse.next()", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Mock handleVercelRequest to throw an error
    vi.mocked(handleVercelRequest).mockRejectedValue(new Error("Test error"))

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const handler = appwardenOnVercel(mockInputFn)

    // The function should throw the error
    await expect(handler(mockRequest, mockEvent)).rejects.toThrow("Test error")

    // But it should also log the error
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it("should not log error if it's in globalErrors", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Create an error that's in globalErrors
    const globalError = new Error(globalErrors[0])

    // Mock handleVercelRequest to throw the global error
    vi.mocked(handleVercelRequest).mockRejectedValue(globalError)

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const handler = appwardenOnVercel(mockInputFn)

    // The function should throw the error
    await expect(handler(mockRequest, mockEvent)).rejects.toThrow(
      globalErrors[0],
    )

    // But it should not log the error since it's in globalErrors
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  // Edge Cases

  it("should handle empty URL", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Set up a request with empty URL
    mockRequest = {
      ...mockRequest,
      url: "",
      headers: new Headers({
        accept: "text/html",
      }),
    } as unknown as NextRequest

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const handler = appwardenOnVercel(mockInputFn)

    // The function should throw an error
    await expect(handler(mockRequest, mockEvent)).rejects.toThrow()

    // And log the error
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it("should handle malformed headers", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Set up a request with null headers
    mockRequest = {
      ...mockRequest,
      url: "https://example.com",
      headers: null,
    } as unknown as NextRequest

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const handler = appwardenOnVercel(mockInputFn)

    // The function should throw an error
    await expect(handler(mockRequest, mockEvent)).rejects.toThrow()

    // And log the error
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it("should handle undefined cache value", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Mock handleVercelRequest to return undefined
    vi.mocked(handleVercelRequest).mockResolvedValue(undefined)

    // Mock MemoryCache.isExpired to return true for undefined
    const originalIsExpired = (MemoryCache as any).isExpired
    ;(MemoryCache as any).isExpired = vi.fn().mockReturnValue(true)

    const handler = appwardenOnVercel(mockInputFn)
    await handler(mockRequest, mockEvent)

    // Should try to sync edge value
    expect(syncEdgeValue).toHaveBeenCalled()
    expect(mockEvent.waitUntil).toHaveBeenCalled()

    // Restore original
    ;(MemoryCache as any).isExpired = originalIsExpired
  })

  it("should not sync edge value when cache is valid", async () => {
    // Mock AppwardenConfigSchema.safeParse to succeed
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: mockInputFn,
    })

    // Mock handleVercelRequest to return a valid cache value
    vi.mocked(handleVercelRequest).mockResolvedValue({
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "OK",
    } as LockValueType)

    // Mock MemoryCache.isExpired to return false (cache is valid)
    const originalIsExpired = (MemoryCache as any).isExpired
    ;(MemoryCache as any).isExpired = vi.fn().mockReturnValue(false)

    const handler = appwardenOnVercel(mockInputFn)
    await handler(mockRequest, mockEvent)

    // Should not try to sync edge value
    expect(syncEdgeValue).not.toHaveBeenCalled()
    expect(mockEvent.waitUntil).not.toHaveBeenCalled()

    // Restore original
    ;(MemoryCache as any).isExpired = originalIsExpired
  })

  // Different Configurations

  it("should use upstash provider when cacheUrl is upstash URL", async () => {
    // Create upstash config
    const upstashConfig = {
      cacheUrl: "rediss://:password@hostname.upstash.io:6379",
      appwardenApiToken: "test-token",
      lockPageSlug: "/maintenance",
    }

    // Mock AppwardenConfigSchema.safeParse to succeed with upstash config
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: upstashConfig,
    })

    // Mock isCacheUrl.edgeConfig to return false
    vi.mocked(isCacheUrl.edgeConfig).mockReturnValue(false)

    // Mock isCacheUrl.upstash to return true
    vi.mocked(isCacheUrl.upstash).mockReturnValue(true)

    const handler = appwardenOnVercel(upstashConfig)
    await handler(mockRequest, mockEvent)

    // Verify context passed to handleVercelRequest has upstash provider
    const context = vi.mocked(handleVercelRequest).mock.calls[0][0]
    expect(context.provider).toBe("upstash")
  })

  it("should use custom lockPageSlug", async () => {
    // Create config with custom lockPageSlug
    const customConfig = {
      ...mockInputFn,
      lockPageSlug: "/custom-maintenance",
    }

    // Mock AppwardenConfigSchema.safeParse to succeed with custom config
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: customConfig,
    })

    // Mock handleVercelRequest to call onLocked
    vi.mocked(handleVercelRequest).mockImplementation(
      async (_context, options) => {
        options.onLocked()
        return { isLocked: 1 } as LockValueType
      },
    )

    const handler = appwardenOnVercel(customConfig)
    const result = await handler(mockRequest, mockEvent)

    // Should rewrite to custom lockPageSlug
    expect(NextResponse.rewrite).toHaveBeenCalled()
    expect(result).toEqual({
      type: "rewrite",
      url: expect.objectContaining({
        pathname: "/custom-maintenance",
      }),
      options: expect.any(Object),
    })
  })

  it("should work with minimal configuration", async () => {
    // Create minimal config
    const minimalConfig = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "test-token",
      lockPageSlug: "/maintenance",
    }

    // Mock AppwardenConfigSchema.safeParse to succeed with minimal config
    vi.mocked(AppwardenConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: minimalConfig,
    })

    const handler = appwardenOnVercel(minimalConfig)
    await handler(mockRequest, mockEvent)

    // Verify context passed to handleVercelRequest
    const context = vi.mocked(handleVercelRequest).mock.calls[0][0]
    expect(context.cacheUrl).toBe(minimalConfig.cacheUrl)
    expect(context.appwardenApiToken).toBe(minimalConfig.appwardenApiToken)
    expect(context.lockPageSlug).toBe(minimalConfig.lockPageSlug)
    expect(context.vercelApiToken).toBeUndefined()
  })
})

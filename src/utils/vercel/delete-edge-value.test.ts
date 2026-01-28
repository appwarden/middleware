import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VercelProviderContext } from "../../types"
import { printMessage } from "../print-message"
import { deleteEdgeValue } from "./delete-edge-value"

// Mock dependencies
vi.mock("../print-message", () => ({
  printMessage: vi.fn((msg) => `[MOCK] ${msg}`),
}))

vi.mock("../is-cache-url", () => ({
  getEdgeConfigId: vi.fn().mockImplementation((url) => {
    if (url === "https://edge-config.vercel.com/ecfg_123?token=abc") {
      return "ecfg_123"
    }
    return null
  }),
}))

// Mock @upstash/redis
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    del: vi.fn(),
  })),
}))

// Mock fetch
const originalFetch = global.fetch
const mockFetch = vi.fn()

describe("deleteEdgeValue", () => {
  // Mock console.error
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    global.fetch = mockFetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    global.fetch = originalFetch
  })

  it("should delete edge value for edge-config provider", async () => {
    // Mock successful fetch response
    mockFetch.mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({}),
    })

    // Create mock context
    const mockContext = {
      keyName: "appwarden-lock",
      provider: "edge-config",
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      vercelApiToken: "test-token",
      appwardenApiToken: "test-token",
      requestUrl: new URL("https://example.com"),
      lockPageSlug: "/locked",
    } as VercelProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.vercel.com/v1/edge-config/ecfg_123/items",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              key: "appwarden-lock",
              operation: "delete",
            },
          ],
        }),
      },
    )

    // Verify console.error was not called
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("should handle edge-config API error", async () => {
    // Mock failed fetch response
    mockFetch.mockResolvedValueOnce({
      status: 400,
      statusText: "Bad Request",
      json: vi.fn().mockResolvedValue({
        error: { message: "Invalid token" },
      }),
    })

    // Create mock context
    const mockContext = {
      keyName: "appwarden-lock",
      provider: "edge-config",
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      vercelApiToken: "test-token",
      appwardenApiToken: "test-token",
      requestUrl: new URL("https://example.com"),
      lockPageSlug: "/locked",
    } as VercelProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to delete edge value"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should handle invalid edge-config ID", async () => {
    // Create mock context with invalid cacheUrl
    const mockContext = {
      keyName: "appwarden-lock",
      provider: "edge-config",
      cacheUrl: "https://invalid-url.com",
      vercelApiToken: "test-token",
      appwardenApiToken: "test-token",
      requestUrl: new URL("https://example.com"),
      lockPageSlug: "/locked",
    } as VercelProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to delete edge value - Failed to parse `edgeConfigId`",
      ),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should delete edge value for upstash provider", async () => {
    // Mock Redis client
    const mockRedis = {
      del: vi.fn().mockResolvedValue(1),
    }

    // Mock Redis constructor
    const { Redis } = await import("@upstash/redis")
    vi.mocked(Redis).mockImplementation(() => mockRedis as any)

    // Create mock context
    const mockContext = {
      keyName: "appwarden-lock",
      provider: "upstash",
      cacheUrl: "redis://:password@funky-roughy-44527.upstash.io:6379",
      vercelApiToken: "test-token",
      appwardenApiToken: "test-token",
      requestUrl: new URL("https://example.com"),
      lockPageSlug: "/locked",
    } as VercelProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify Redis was instantiated with correct parameters
    expect(Redis).toHaveBeenCalledWith({
      url: "https://funky-roughy-44527.upstash.io",
      token: "password",
    })

    // Verify del was called with correct key
    expect(mockRedis.del).toHaveBeenCalledWith("appwarden-lock")

    // Verify console.error was not called
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("should handle edge-config API error with invalid JSON response", async () => {
    // Mock failed fetch response with invalid JSON
    mockFetch.mockResolvedValueOnce({
      status: 500,
      statusText: "Internal Server Error",
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
    })

    // Create mock context
    const mockContext = {
      keyName: "appwarden-lock",
      provider: "edge-config",
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      vercelApiToken: "test-token",
      appwardenApiToken: "test-token",
      requestUrl: new URL("https://example.com"),
      lockPageSlug: "/locked",
    } as VercelProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify error was logged (without the error message from JSON)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to delete edge value - api.vercel.com/v1/edge-config responded with 500 - Internal Server Error",
      ),
    )
    expect(printMessage).toHaveBeenCalled()
  })
})

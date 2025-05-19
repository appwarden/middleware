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

// Mock fetch
const originalFetch = global.fetch
const mockFetch = vi.fn()

describe("deleteEdgeValue", () => {
  // Mock console.error
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
    global.fetch = mockFetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.error = originalConsoleError
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
    expect(console.error).not.toHaveBeenCalled()
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
    expect(console.error).toHaveBeenCalledWith(
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
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to delete edge value - Failed to parse `edgeConfigId`",
      ),
    )
    expect(printMessage).toHaveBeenCalled()
  })
})

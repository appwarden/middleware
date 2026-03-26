import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VercelProviderContext } from "../../types"
import { printMessage } from "../print-message"
import { syncEdgeValue } from "./sync-edge-value"

vi.mock("../print-message", () => ({
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
}))

// Mock fetch
const originalFetch = global.fetch
let mockFetchResponse: Response

type SyncEdgeContext = Pick<
  VercelProviderContext,
  | "cacheUrl"
  | "requestUrl"
  | "vercelApiToken"
  | "appwardenApiToken"
  | "appwardenApiHostname"
  | "debug"
>

describe("syncEdgeValue", () => {
  // Mock console.error and console.log
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let mockContext: SyncEdgeContext

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    // Setup mock fetch
    mockFetchResponse = new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    })

    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse)

    // Setup mock context
    mockContext = {
      requestUrl: new URL("https://example.com"),
      appwardenApiToken: "test-token",
      vercelApiToken: "vercel-token",
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      debug: vi.fn(),
    }

    // Reset mocks
    vi.clearAllMocks()

    // Define API constants
    // @ts-ignore - Defining constants that are normally defined by the build process
    global.API_HOSTNAME = "https://staging-api.appwarden.io"
    // @ts-ignore
    global.API_PATHNAME = "/v1/appwarden/status"
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
    global.fetch = originalFetch
  })

  it("should call the API with correct parameters", async () => {
    await syncEdgeValue(mockContext)

    expect(fetch).toHaveBeenCalledWith(
      new URL("/v1/appwarden/status", "https://staging-api.appwarden.io"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service: "vercel",
          cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
          fqdn: "example.com",
          vercelApiToken: "vercel-token",
          appwardenApiToken: "test-token",
        }),
      },
    )

    expect(mockContext.debug).toHaveBeenCalledWith("syncing with api")
  })

  it("should handle API errors", async () => {
    // Mock error response
    mockFetchResponse = new Response(
      JSON.stringify({ error: { message: "API Error" } }),
      {
        status: 422,
        headers: { "content-type": "application/json" },
      },
    )

    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse)

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch from check endpoint - 422"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should log a domain verification message when the API returns 403", async () => {
    // Mock 403 Forbidden response
    mockFetchResponse = new Response("Forbidden", {
      status: 403,
      statusText: "Forbidden",
      headers: { "content-type": "application/json" },
    })

    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse)

    await syncEdgeValue(mockContext)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[@appwarden/middleware] Verifying domain ownership... this will only take a few minutes.",
    )
    expect(printMessage).toHaveBeenCalledWith(
      "Verifying domain ownership... this will only take a few minutes.",
    )
  })

  it("should handle network errors", async () => {
    // Mock network error
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to fetch from check endpoint - Network error",
      ),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should handle API error messages", async () => {
    // Mock error response with error message
    mockFetchResponse = new Response(
      JSON.stringify({ error: { message: "Invalid token" } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )

    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse)

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid token"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should use a custom appwarden API hostname when provided", async () => {
    mockContext.appwardenApiHostname = "https://custom-api.appwarden.io"

    await syncEdgeValue(mockContext)

    expect(fetch).toHaveBeenCalledWith(
      new URL("/v1/appwarden/status", "https://custom-api.appwarden.io"),
      expect.any(Object),
    )
  })
})

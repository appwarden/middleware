import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LockValue } from "../../schemas"
import { CloudflareProviderContext } from "../../types/cloudflare"
import { debug } from "../debug"
import { syncEdgeValue } from "./sync-edge-value"

// Mock dependencies
vi.mock("../../schemas", () => ({
  LockValue: {
    omit: vi.fn(() => ({
      parse: vi.fn((value) => value),
    })),
  },
}))

vi.mock("../debug", () => ({
  debug: vi.fn(),
}))

vi.mock("../print-message", () => ({
  printMessage: vi.fn((message) => `[@appwarden/middleware] ${message}`),
}))

// Mock global fetch
const originalFetch = global.fetch
let mockFetchResponse: Response

beforeEach(() => {
  global.fetch = vi
    .fn()
    .mockImplementation(() => Promise.resolve(mockFetchResponse))
})

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

// Mock console.error
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  consoleErrorSpy.mockRestore()
})

// Define API constants that are normally injected at build time
vi.stubGlobal("API_HOSTNAME", "https://staging-api.appwarden.io")
vi.stubGlobal("API_PATHNAME", "/v1/status/check")

describe("syncEdgeValue", () => {
  let mockContext: CloudflareProviderContext

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock context
    mockContext = {
      provider: "cloudflare-cache",
      requestUrl: new URL("https://example.com"),
      appwardenApiToken: "test-token",
      keyName: "appwarden-lock",
      edgeCache: {
        getValue: vi.fn(),
        updateValue: vi.fn(),
        deleteValue: vi.fn(),
      },
      request: new Request("https://example.com"),
      debug: false,
      lockPageSlug: "/maintenance",
      waitUntil: vi.fn(),
    }

    // Default mock response
    mockFetchResponse = new Response(
      JSON.stringify({
        content: {
          isLocked: 0,
          isLockedTest: 0,
          code: "test-code",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )
  })

  it("should call the API with correct parameters", async () => {
    await syncEdgeValue(mockContext)

    expect(fetch).toHaveBeenCalledWith(
      new URL("/v1/status/check", "https://staging-api.appwarden.io"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service: "cloudflare",
          provider: "cloudflare-cache",
          fqdn: "example.com",
          appwardenApiToken: "test-token",
        }),
      },
    )

    expect(debug).toHaveBeenCalledWith("syncing with api")
  })

  it("should update the edge cache with the API response", async () => {
    const mockApiContent = {
      isLocked: 0,
      isLockedTest: 0,
      code: "test-code",
    }

    mockFetchResponse = new Response(
      JSON.stringify({
        content: mockApiContent,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )

    await syncEdgeValue(mockContext)

    expect(mockContext.edgeCache.updateValue).toHaveBeenCalledWith({
      ...mockApiContent,
      lastCheck: expect.any(Number),
    })

    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining("syncing with api...DONE"),
    )
  })

  it("should handle API errors", async () => {
    mockFetchResponse = new Response(
      JSON.stringify({
        error: { message: "API error message" },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[@appwarden/middleware] API error message",
    )
    expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
  })

  it("should handle non-200 responses", async () => {
    mockFetchResponse = new Response("Error", {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: { "content-type": "application/json" },
    })

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[@appwarden/middleware] Failed to fetch from check endpoint - 422 Unprocessable Entity",
    )
    expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
  })

  it("should handle missing content in response", async () => {
    mockFetchResponse = new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    })

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[@appwarden/middleware] no content from api",
    )
    expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
  })

  it("should handle parsing errors", async () => {
    // Mock LockValue.omit().parse to throw an error
    // Mock the parse method to throw an error
    const mockParse = vi.fn(() => {
      throw new Error("Parse error")
    })

    // Create a mock object with the necessary structure
    const mockOmitResult = { parse: mockParse } as any

    // Use the mock
    vi.mocked(LockValue.omit).mockReturnValueOnce(mockOmitResult)

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[@appwarden/middleware] Failed to parse check endpoint result - Error: Parse error",
    )
    expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
  })

  it("should handle fetch errors", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"))

    await syncEdgeValue(mockContext)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[@appwarden/middleware] Failed to fetch from check endpoint - Network error",
    )
    expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
  })

  describe("HTTP Error Code Handling", () => {
    it("should handle 401 Unauthorized (invalid API token)", async () => {
      mockFetchResponse = new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          statusText: "Unauthorized",
          headers: { "content-type": "application/json" },
        },
      )

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 401 Unauthorized",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle 403 Forbidden", async () => {
      mockFetchResponse = new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        statusText: "Forbidden",
        headers: { "content-type": "application/json" },
      })

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 403 Forbidden",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle 429 Rate Limiting", async () => {
      mockFetchResponse = new Response(
        JSON.stringify({ error: "Too Many Requests" }),
        {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "content-type": "application/json" },
        },
      )

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 429 Too Many Requests",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle 500 Internal Server Error", async () => {
      mockFetchResponse = new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "content-type": "application/json" },
        },
      )

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 500 Internal Server Error",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle 502 Bad Gateway", async () => {
      mockFetchResponse = new Response(
        JSON.stringify({ error: "Bad Gateway" }),
        {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "content-type": "application/json" },
        },
      )

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 502 Bad Gateway",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle 503 Service Unavailable", async () => {
      mockFetchResponse = new Response(
        JSON.stringify({ error: "Service Unavailable" }),
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "content-type": "application/json" },
        },
      )

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 503 Service Unavailable",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle 504 Gateway Timeout", async () => {
      mockFetchResponse = new Response(
        JSON.stringify({ error: "Gateway Timeout" }),
        {
          status: 504,
          statusText: "Gateway Timeout",
          headers: { "content-type": "application/json" },
        },
      )

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - 504 Gateway Timeout",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle network timeout errors", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Request timeout"))

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - Request timeout",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle DNS resolution failures", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"))

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[@appwarden/middleware] Failed to fetch from check endpoint - getaddrinfo ENOTFOUND",
      )
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle malformed JSON response", async () => {
      mockFetchResponse = new Response("Not valid JSON", {
        status: 200,
        headers: { "content-type": "application/json" },
      })

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle empty response body", async () => {
      mockFetchResponse = new Response("", {
        status: 200,
        headers: { "content-type": "application/json" },
      })

      await syncEdgeValue(mockContext)

      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })

    it("should handle non-JSON content-type", async () => {
      mockFetchResponse = new Response("<html>Error</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })

      await syncEdgeValue(mockContext)

      // Should not attempt to parse non-JSON response
      expect(mockContext.edgeCache.updateValue).not.toHaveBeenCalled()
    })
  })
})

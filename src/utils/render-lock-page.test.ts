import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CloudflareProviderContext } from "../types/cloudflare"
import { renderLockPage } from "./render-lock-page"

describe("renderLockPage", () => {
  // Store the original fetch function
  const originalFetch = global.fetch

  // Mock fetch
  beforeEach(() => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("Maintenance page content"))
  })

  // Restore original fetch after tests
  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  it("should fetch the lock page from the correct URL", async () => {
    // Create a mock context
    const mockContext: CloudflareProviderContext = {
      provider: "cloudflare-cache",
      requestUrl: new URL("https://example.com/some-path"),
      appwardenApiToken: "test-token",
      keyName: "appwarden-lock",
      edgeCache: {
        getValue: vi.fn(),
        updateValue: vi.fn(),
        deleteValue: vi.fn(),
      },
      request: new Request("https://example.com/some-path"),
      debug: false,
      lockPageSlug: "/maintenance",
      waitUntil: vi.fn(),
    }

    // Call the function
    await renderLockPage(mockContext)

    // Check that fetch was called with the correct URL and headers
    expect(fetch).toHaveBeenCalledWith(
      new URL("/maintenance", "https://example.com"),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  })

  it("should use the lockPageSlug from the context", async () => {
    // Create a mock context with a custom lockPageSlug
    const mockContext: CloudflareProviderContext = {
      provider: "cloudflare-cache",
      requestUrl: new URL("https://example.com/some-path"),
      appwardenApiToken: "test-token",
      keyName: "appwarden-lock",
      edgeCache: {
        getValue: vi.fn(),
        updateValue: vi.fn(),
        deleteValue: vi.fn(),
      },
      request: new Request("https://example.com/some-path"),
      debug: false,
      lockPageSlug: "/custom-maintenance",
      waitUntil: vi.fn(),
    }

    // Call the function
    await renderLockPage(mockContext)

    // Check that fetch was called with the correct URL
    expect(fetch).toHaveBeenCalledWith(
      new URL("/custom-maintenance", "https://example.com"),
      expect.any(Object),
    )
  })

  it("should return the response from fetch", async () => {
    // Create a mock context
    const mockContext: CloudflareProviderContext = {
      provider: "cloudflare-cache",
      requestUrl: new URL("https://example.com/some-path"),
      appwardenApiToken: "test-token",
      keyName: "appwarden-lock",
      edgeCache: {
        getValue: vi.fn(),
        updateValue: vi.fn(),
        deleteValue: vi.fn(),
      },
      request: new Request("https://example.com/some-path"),
      debug: false,
      lockPageSlug: "/maintenance",
      waitUntil: vi.fn(),
    }

    // Mock fetch to return a specific response
    const mockResponse = new Response("Maintenance page content", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    })
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    // Call the function
    const result = await renderLockPage(mockContext)

    // Check that the result is the response from fetch
    expect(result).toBe(mockResponse)
  })
})

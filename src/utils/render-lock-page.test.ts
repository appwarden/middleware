import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderLockPage, RenderLockPageContext } from "./render-lock-page"

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
    // Create a mock context with only the required properties
    const mockContext: RenderLockPageContext = {
      requestUrl: new URL("https://example.com/some-path"),
      lockPageSlug: "/maintenance",
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
    const mockContext: RenderLockPageContext = {
      requestUrl: new URL("https://example.com/some-path"),
      lockPageSlug: "/custom-maintenance",
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
    const mockContext: RenderLockPageContext = {
      requestUrl: new URL("https://example.com/some-path"),
      lockPageSlug: "/maintenance",
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

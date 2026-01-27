import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useFetchOrigin } from "./use-fetch-origin"

// Mock global fetch
const originalFetch = global.fetch
const mockFetch = vi.fn()

describe("useFetchOrigin", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("should fetch the origin and set the response in context", async () => {
    // Create mock response
    const mockResponse = new Response("Test response")
    mockFetch.mockResolvedValue(mockResponse)

    // Create middleware
    const middleware = useFetchOrigin()

    // Create context with request
    const originalRequest = new Request("https://example.com")
    const context = {
      request: originalRequest,
      response: new Response(), // Initialize with an empty response
      hostname: "example.com",
      waitUntil: vi.fn(),
    }

    // Create mock next function
    const next = vi.fn()

    // Execute middleware
    await middleware(context, next)

    // Verify fetch was called with a Request object
    expect(mockFetch).toHaveBeenCalledWith(expect.any(Request))

    // Verify the Request object has the correct properties
    const fetchedRequest = mockFetch.mock.calls[0][0] as Request
    expect(fetchedRequest.url).toBe("https://example.com")
    expect(fetchedRequest.redirect).toBe("follow")

    // Verify response was set in context
    expect(context.response).toBe(mockResponse)

    // Verify next was called
    expect(next).toHaveBeenCalled()
  })

  it("should handle fetch errors", async () => {
    // Mock fetch to throw an error
    const fetchError = new Error("Fetch failed")
    mockFetch.mockRejectedValue(fetchError)

    // Create middleware
    const middleware = useFetchOrigin()

    // Create context with request
    const context = {
      request: new Request("https://example.com"),
      response: new Response(), // Initialize with an empty response
      hostname: "example.com",
      waitUntil: vi.fn(),
    }

    // Create mock next function
    const next = vi.fn()

    // Execute middleware and expect it to throw
    await expect(middleware(context, next)).rejects.toThrow("Fetch failed")

    // Verify next was not called
    expect(next).not.toHaveBeenCalled()
  })
})

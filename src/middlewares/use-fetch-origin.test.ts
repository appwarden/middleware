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
      debug: vi.fn(),
    }

    // Create mock next function
    const next = vi.fn()

    // Execute middleware
    await middleware(context, next)

    // Verify fetch was called with a Request object
    expect(mockFetch).toHaveBeenCalledWith(expect.any(Request))

    // Verify the Request object has the correct properties
    const fetchedRequest = mockFetch.mock.calls[0][0] as Request
    expect(fetchedRequest.url).toBe("https://example.com/")
    expect(fetchedRequest.redirect).toBe("manual")

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
      debug: vi.fn(),
    }

    // Create mock next function
    const next = vi.fn()

    // Execute middleware and expect it to throw
    await expect(middleware(context, next)).rejects.toThrow("Fetch failed")

    // Verify next was not called
    expect(next).not.toHaveBeenCalled()
  })

  it("should log debug message for opaque redirect responses", async () => {
    // Create a mock response and override its type property to simulate opaque redirect
    // We can't use new Response(null, { status: 0 }) because the Response constructor
    // validates that status must be 200-599
    const mockResponse = new Response(null, { status: 200 })
    Object.defineProperty(mockResponse, "type", {
      value: "opaqueredirect",
      writable: false,
    })
    mockFetch.mockResolvedValue(mockResponse)

    // Create middleware
    const middleware = useFetchOrigin()

    // Create context with request
    const debugFn = vi.fn()
    const context = {
      request: new Request("https://example.com"),
      response: new Response(),
      hostname: "example.com",
      waitUntil: vi.fn(),
      debug: debugFn,
    }

    // Create mock next function
    const next = vi.fn()

    // Execute middleware
    await middleware(context, next)

    // Verify debug was called with opaque redirect message
    expect(debugFn).toHaveBeenCalledWith(
      "Origin returned a redirect (opaque response) - client will handle redirect",
    )

    // Verify response was set in context
    expect(context.response).toBe(mockResponse)

    // Verify next was called
    expect(next).toHaveBeenCalled()
  })

  it("should not log debug message for non-redirect responses", async () => {
    // Create mock normal response
    const mockResponse = new Response("OK", { status: 200 })
    mockFetch.mockResolvedValue(mockResponse)

    // Create middleware
    const middleware = useFetchOrigin()

    // Create context with request
    const debugFn = vi.fn()
    const context = {
      request: new Request("https://example.com"),
      response: new Response(),
      hostname: "example.com",
      waitUntil: vi.fn(),
      debug: debugFn,
    }

    // Create mock next function
    const next = vi.fn()

    // Execute middleware
    await middleware(context, next)

    // Verify debug was not called with opaque redirect message
    expect(debugFn).not.toHaveBeenCalledWith(expect.stringContaining("opaque"))

    // Verify response was set in context
    expect(context.response).toBe(mockResponse)

    // Verify next was called
    expect(next).toHaveBeenCalled()
  })
})

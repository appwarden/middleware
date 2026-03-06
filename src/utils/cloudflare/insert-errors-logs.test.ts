import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import { MiddlewareContext } from "../../types"
import { getErrors } from "../errors"
import { insertErrorLogs } from "./insert-errors-logs"

// Mock dependencies
vi.mock("../errors", () => ({
  getErrors: vi.fn(),
}))

vi.mock("../print-message", () => ({
  printMessage: vi.fn((msg) => `[MOCK] ${msg}`),
}))

describe("insertErrorLogs", () => {
  // Mock console.log
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  // Mock fetch
  const originalFetch = global.fetch

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    global.fetch = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    global.fetch = originalFetch
  })

  it("should insert error logs into HTML response", async () => {
    // Mock errors
    const mockErrors = ["Error 1", "Error 2"]
    vi.mocked(getErrors).mockReturnValue(mockErrors)

    // Mock response
    const mockResponse = new Response("<html><body>Test</body></html>")
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    // Mock HTMLRewriter
    const mockTransform = vi.fn().mockReturnValue(new Response("transformed"))
    const mockAppend = vi.fn()
    const mockOn = vi.fn().mockReturnThis()

    // Create a mock class for HTMLRewriter
    class MockHTMLRewriter {
      on = mockOn
      transform = mockTransform
    }

    // @ts-ignore - mocking HTMLRewriter
    global.HTMLRewriter = MockHTMLRewriter

    // Mock element
    const mockElement = {
      append: mockAppend,
    }

    // Create mock context with a request that has a body
    const mockContext = {
      request: new Request("https://example.com", {
        method: "POST",
        body: "test body",
      }),
    } as MiddlewareContext

    // Create mock ZodError
    const mockZodError = new ZodError([])

    // Call the function
    const result = await insertErrorLogs(mockContext, mockZodError)

    // Verify fetch was called with a cloned request (not the original)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const fetchedRequest = vi.mocked(global.fetch).mock.calls[0][0] as Request
    expect(fetchedRequest.url).toBe(mockContext.request.url)
    expect(fetchedRequest.method).toBe(mockContext.request.method)
    // The cloned request should be a different instance
    expect(fetchedRequest).not.toBe(mockContext.request)

    // Verify HTMLRewriter was used
    expect(mockOn).toHaveBeenCalledWith(
      "body",
      expect.objectContaining({
        element: expect.any(Function),
      }),
    )

    // Verify transform was called with the response
    expect(mockTransform).toHaveBeenCalledWith(mockResponse)

    // Verify errors were logged
    expect(consoleLogSpy).toHaveBeenCalledTimes(2)
    expect(consoleLogSpy).toHaveBeenCalledWith("[MOCK] Error 1")
    expect(consoleLogSpy).toHaveBeenCalledWith("[MOCK] Error 2")

    // Verify result is the transformed response
    expect(result).toBeDefined()
    expect(mockTransform).toHaveBeenCalledWith(mockResponse)

    // Call the element handler to test append functionality
    const elementHandler = mockOn.mock.calls[0][1]
    elementHandler.element(mockElement)

    // Verify append was called with script containing errors
    expect(mockAppend).toHaveBeenCalledWith(
      expect.stringContaining("console.error"),
      { html: true },
    )
    expect(mockAppend.mock.calls[0][0]).toContain("[MOCK] Error 1")
    expect(mockAppend.mock.calls[0][0]).toContain("[MOCK] Error 2")
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CloudflareProviderContext } from "../../types"
import { printMessage } from "../print-message"
import { deleteEdgeValue } from "./delete-edge-value"

// Mock dependencies
vi.mock("../print-message", () => ({
  printMessage: vi.fn((msg) => `[MOCK] ${msg}`),
}))

describe("deleteEdgeValue", () => {
  // Mock console.error
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("should delete edge value for cloudflare-cache provider", async () => {
    // Create mock context
    const mockContext = {
      provider: "cloudflare-cache",
      edgeCache: {
        deleteValue: vi.fn().mockResolvedValue(true),
      },
    } as unknown as CloudflareProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify edgeCache.deleteValue was called
    expect(mockContext.edgeCache.deleteValue).toHaveBeenCalled()

    // Verify console.error was not called
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("should handle deletion failure", async () => {
    // Create mock context with failing deleteValue
    const mockContext = {
      provider: "cloudflare-cache",
      edgeCache: {
        deleteValue: vi.fn().mockResolvedValue(false),
      },
    } as unknown as CloudflareProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify edgeCache.deleteValue was called
    expect(mockContext.edgeCache.deleteValue).toHaveBeenCalled()

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to delete edge value"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should handle exceptions during deletion", async () => {
    // Create mock context with throwing deleteValue
    const mockContext = {
      provider: "cloudflare-cache",
      edgeCache: {
        deleteValue: vi.fn().mockRejectedValue(new Error("Test error")),
      },
    } as unknown as CloudflareProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify edgeCache.deleteValue was called
    expect(mockContext.edgeCache.deleteValue).toHaveBeenCalled()

    // Verify error was logged with the error message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to delete edge value - Test error"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should throw for unsupported providers", async () => {
    // Create mock context with unsupported provider
    const mockContext = {
      provider: "unsupported-provider",
    } as unknown as CloudflareProviderContext

    // Call the function
    await deleteEdgeValue(mockContext)

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported provider: unsupported-provider"),
    )
    expect(printMessage).toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LockValue, LockValueType } from "../../schemas"
import { CloudflareProviderContext } from "../../types"
import { printMessage } from "../print-message"
import { getLockValue } from "./get-lock-value"

// Mock dependencies
vi.mock("../../schemas", () => ({
  LockValue: {
    parse: vi.fn(),
  },
}))

vi.mock("../print-message", () => ({
  printMessage: vi.fn((msg) => `[MOCK] ${msg}`),
}))

describe("getLockValue", () => {
  // Mock console.error
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it("should get lock value for cloudflare-cache provider", async () => {
    // Mock lock value
    const mockLockValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Mock response
    const mockResponse = {
      clone: vi.fn().mockReturnThis(),
      json: vi.fn().mockResolvedValue(mockLockValue),
    }

    // Create mock context
    const mockContext = {
      provider: "cloudflare-cache",
      keyName: "/appwarden-lock",
      edgeCache: {
        getValue: vi.fn().mockResolvedValue(mockResponse),
      },
    } as unknown as CloudflareProviderContext

    // Mock LockValue.parse
    vi.mocked(LockValue.parse).mockReturnValue(mockLockValue)

    // Call the function
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: mockLockValue,
      shouldDeleteEdgeValue: false,
    })

    // Verify edgeCache.getValue was called
    expect(mockContext.edgeCache.getValue).toHaveBeenCalled()

    // Verify response was cloned and parsed
    expect(mockResponse.clone).toHaveBeenCalled()
    expect(mockResponse.json).toHaveBeenCalled()
    expect(LockValue.parse).toHaveBeenCalledWith(mockLockValue)

    // Verify console.error was not called
    expect(console.error).not.toHaveBeenCalled()
  })

  it("should return undefined when no cache response", async () => {
    // Create mock context with no cache response
    const mockContext = {
      provider: "cloudflare-cache",
      keyName: "/appwarden-lock",
      edgeCache: {
        getValue: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as CloudflareProviderContext

    // Call the function
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: undefined,
    })

    // Verify edgeCache.getValue was called
    expect(mockContext.edgeCache.getValue).toHaveBeenCalled()

    // Verify LockValue.parse was not called
    expect(LockValue.parse).not.toHaveBeenCalled()

    // Verify console.error was not called
    expect(console.error).not.toHaveBeenCalled()
  })

  it("should handle parse errors", async () => {
    // Mock response with invalid JSON
    const mockResponse = {
      clone: vi.fn().mockReturnThis(),
      json: vi.fn().mockResolvedValue({ invalid: "data" }),
    }

    // Create mock context
    const mockContext = {
      provider: "cloudflare-cache",
      keyName: "/appwarden-lock",
      edgeCache: {
        getValue: vi.fn().mockResolvedValue(mockResponse),
      },
    } as unknown as CloudflareProviderContext

    // Mock LockValue.parse to throw an error
    vi.mocked(LockValue.parse).mockImplementation(() => {
      throw new Error("Invalid lock value")
    })

    // Call the function
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: expect.objectContaining({
        isLocked: 0,
        isLockedTest: 0,
        code: "",
      }),
      shouldDeleteEdgeValue: true,
    })

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to parse /appwarden-lock from edge cache",
      ),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should handle exceptions during getValue", async () => {
    // Create mock context with throwing getValue
    const mockContext = {
      provider: "cloudflare-cache",
      keyName: "/appwarden-lock",
      edgeCache: {
        getValue: vi.fn().mockRejectedValue(new Error("Test error")),
      },
    } as unknown as CloudflareProviderContext

    // Call the function
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: undefined,
    })

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to retrieve edge value - Test error"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should throw for unsupported providers", async () => {
    // Create mock context with unsupported provider
    const mockContext = {
      provider: "unsupported-provider",
      keyName: "/appwarden-lock",
    } as unknown as CloudflareProviderContext

    // Call the function
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: undefined,
    })

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Unsupported provider: unsupported-provider"),
    )
    expect(printMessage).toHaveBeenCalled()
  })
})

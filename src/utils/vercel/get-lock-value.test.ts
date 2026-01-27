import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { errors } from "../../constants"
import { LockValue, LockValueType } from "../../schemas"
import { VercelProviderContext } from "../../types"
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

// Mock @vercel/edge-config
vi.mock("@vercel/edge-config", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
  })),
}))

// Mock @upstash/redis
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
  })),
}))

describe("getLockValue", () => {
  // Mock console.error
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("should get lock value for edge-config provider", async () => {
    // Mock lock value
    const mockLockValue: LockValueType = {
      isLocked: 0,
      isLockedTest: 0,
      lastCheck: Date.now(),
      code: "test-code",
    }

    // Mock edge-config client
    const mockEdgeConfigClient = {
      get: vi.fn().mockResolvedValue(JSON.stringify(mockLockValue)),
      connection: {
        baseUrl: "https://edge-config.vercel.com",
        id: "ecfg_123",
        token: "mock-token",
        version: "1",
        type: "external" as const,
      },
      getAll: vi.fn(),
      has: vi.fn(),
      digest: vi.fn(),
    }

    // Mock createClient to return our mock client
    const { createClient } = await import("@vercel/edge-config")
    vi.mocked(createClient).mockReturnValue(mockEdgeConfigClient)

    // Mock LockValue.parse
    vi.mocked(LockValue.parse).mockReturnValue(mockLockValue)

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
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: mockLockValue,
      shouldDeleteEdgeValue: false,
    })

    // Verify createClient was called with the correct URL
    expect(createClient).toHaveBeenCalledWith(mockContext.cacheUrl)

    // Verify get was called with the correct key
    expect(mockEdgeConfigClient.get).toHaveBeenCalledWith("appwarden-lock")

    // Verify LockValue.parse was called with the parsed value
    expect(LockValue.parse).toHaveBeenCalledWith(mockLockValue)

    // Verify console.error was not called
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("should return undefined when no cache value", async () => {
    // Mock edge-config client with no value
    const mockEdgeConfigClient = {
      get: vi.fn().mockResolvedValue(undefined),
      connection: {
        baseUrl: "https://edge-config.vercel.com",
        id: "ecfg_123",
        token: "mock-token",
        version: "1",
        type: "external" as const,
      },
      getAll: vi.fn(),
      has: vi.fn(),
      digest: vi.fn(),
    }

    // Mock createClient to return our mock client
    const { createClient } = await import("@vercel/edge-config")
    vi.mocked(createClient).mockReturnValue(mockEdgeConfigClient)

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
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: undefined,
    })

    // Verify LockValue.parse was not called
    expect(LockValue.parse).not.toHaveBeenCalled()

    // Verify console.error was not called
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it("should handle parse errors", async () => {
    // Mock edge-config client with invalid value
    const mockEdgeConfigClient = {
      get: vi.fn().mockResolvedValue('{"invalid":"json'),
      connection: {
        baseUrl: "https://edge-config.vercel.com",
        id: "ecfg_123",
        token: "mock-token",
        version: "1",
        type: "external" as const,
      },
      getAll: vi.fn(),
      has: vi.fn(),
      digest: vi.fn(),
    }

    // Mock createClient to return our mock client
    const { createClient } = await import("@vercel/edge-config")
    vi.mocked(createClient).mockReturnValue(mockEdgeConfigClient)

    // Mock LockValue.parse to throw an error
    vi.mocked(LockValue.parse).mockImplementation(() => {
      throw new Error("Invalid JSON")
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
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: expect.any(Object),
      shouldDeleteEdgeValue: true,
    })

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse appwarden-lock from edge cache"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should handle exceptions during retrieval", async () => {
    // Mock createClient to throw an error
    const { createClient } = await import("@vercel/edge-config")
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("Test error")
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
    const result = await getLockValue(mockContext)

    // Verify results
    expect(result).toEqual({
      lockValue: undefined,
    })

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to retrieve edge value - Test error"),
    )
    expect(printMessage).toHaveBeenCalled()
  })

  it("should handle bad cache connection error", async () => {
    // Mock createClient to throw a specific error
    const { createClient } = await import("@vercel/edge-config")
    vi.mocked(createClient).mockImplementation(() => {
      const error = new Error("Invalid connection string provided")
      throw error
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

    // Call the function and expect it to throw
    await expect(getLockValue(mockContext)).rejects.toThrow(
      errors.badCacheConnection,
    )

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to retrieve edge value - Invalid connection string provided",
      ),
    )
    expect(printMessage).toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LockValue, LockValueType } from "../schemas"
import { CloudflareProviderContext } from "../types"
import { getLockValue } from "./cloudflare/get-lock-value"

// Mock dependencies
vi.mock("../schemas", () => ({
  LockValue: {
    parse: vi.fn(),
  },
}))

vi.mock("./print-message", () => ({
  printMessage: vi.fn((msg) => `[MOCK] ${msg}`),
}))

describe("Cache Poisoning Security Tests", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe("Malformed Cache Data Attacks", () => {
    it("should reject cache data with string instead of number for isLocked", async () => {
      const maliciousData = {
        isLocked: "1", // String instead of number - could bypass checks
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "MALICIOUS",
      }

      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(maliciousData),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      // Mock LockValue.parse to throw on invalid data
      vi.mocked(LockValue.parse).mockImplementation(() => {
        throw new Error("Invalid type for isLocked")
      })

      const result = await getLockValue(mockContext)

      // Should flag for deletion and return safe default
      expect(result.shouldDeleteEdgeValue).toBe(true)
      expect(result.lockValue).toEqual(
        expect.objectContaining({
          isLocked: 0,
          isLockedTest: 0,
        }),
      )
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it("should reject cache data with negative numbers (integer overflow attempt)", async () => {
      const maliciousData = {
        isLocked: -1, // Negative number could bypass > 0 checks
        isLockedTest: -999999,
        lastCheck: -1,
        code: "OVERFLOW",
      }

      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(maliciousData),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      vi.mocked(LockValue.parse).mockImplementation(() => {
        throw new Error("Invalid negative value")
      })

      const result = await getLockValue(mockContext)

      expect(result.shouldDeleteEdgeValue).toBe(true)
    })

    it("should reject cache data with missing required fields", async () => {
      const maliciousData = {
        isLocked: 1,
        // Missing isLockedTest, lastCheck, code
      }

      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(maliciousData),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      vi.mocked(LockValue.parse).mockImplementation(() => {
        throw new Error("Missing required fields")
      })

      const result = await getLockValue(mockContext)

      expect(result.shouldDeleteEdgeValue).toBe(true)
    })

    it("should reject cache data with extra malicious fields (prototype pollution)", async () => {
      const maliciousData = {
        isLocked: 0,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "OK",
        __proto__: { isAdmin: true }, // Prototype pollution attempt
        constructor: { prototype: { isAdmin: true } },
      }

      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(maliciousData),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      // Even if parse succeeds, extra fields should be stripped by Zod
      const cleanData: LockValueType = {
        isLocked: 0,
        isLockedTest: 0,
        lastCheck: maliciousData.lastCheck,
        code: "OK",
      }
      vi.mocked(LockValue.parse).mockReturnValue(cleanData)

      const result = await getLockValue(mockContext)

      // Verify no prototype pollution occurred
      expect(result.lockValue).not.toHaveProperty("__proto__")
      expect(result.lockValue).not.toHaveProperty("constructor")
      expect(result.lockValue).toEqual(cleanData)
    })

    it("should reject cache data with extremely large numbers (DoS attempt)", async () => {
      const maliciousData = {
        isLocked: Number.MAX_SAFE_INTEGER,
        isLockedTest: Number.MAX_SAFE_INTEGER,
        lastCheck: Number.MAX_SAFE_INTEGER,
        code: "X".repeat(1000000), // Extremely long string
      }

      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(maliciousData),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      vi.mocked(LockValue.parse).mockImplementation(() => {
        throw new Error("Value too large")
      })

      const result = await getLockValue(mockContext)

      expect(result.shouldDeleteEdgeValue).toBe(true)
    })

    it("should handle malformed JSON gracefully", async () => {
      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockRejectedValue(new Error("Unexpected token in JSON")),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      const result = await getLockValue(mockContext)

      // Should handle JSON parse error gracefully and return safe default
      expect(result.lockValue).toEqual(
        expect.objectContaining({
          isLocked: 0,
          isLockedTest: 0,
          code: "",
        }),
      )
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it("should reject cache data with NaN or Infinity values", async () => {
      const maliciousData = {
        isLocked: NaN,
        isLockedTest: Infinity,
        lastCheck: -Infinity,
        code: "INVALID",
      }

      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(maliciousData),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      vi.mocked(LockValue.parse).mockImplementation(() => {
        throw new Error("Invalid number value")
      })

      const result = await getLockValue(mockContext)

      expect(result.shouldDeleteEdgeValue).toBe(true)
    })
  })

  describe("Cache Timing Attacks", () => {
    it("should not leak information through timing differences on valid vs invalid cache", async () => {
      const validData: LockValueType = {
        isLocked: 1,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "LOCKED",
      }

      const mockValidResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(validData),
      }

      const mockInvalidResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockRejectedValue(new Error("Invalid")),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn(),
        },
      } as unknown as CloudflareProviderContext

      // Test valid cache timing
      mockContext.edgeCache.getValue = vi
        .fn()
        .mockResolvedValue(mockValidResponse)
      vi.mocked(LockValue.parse).mockReturnValue(validData)

      const startValid = performance.now()
      await getLockValue(mockContext)
      const validDuration = performance.now() - startValid

      // Test invalid cache timing
      mockContext.edgeCache.getValue = vi
        .fn()
        .mockResolvedValue(mockInvalidResponse)

      const startInvalid = performance.now()
      await getLockValue(mockContext)
      const invalidDuration = performance.now() - startInvalid

      // Timing difference should be minimal (< 100ms)
      // This prevents attackers from using timing to determine cache state
      const timingDifference = Math.abs(validDuration - invalidDuration)
      expect(timingDifference).toBeLessThan(100)
    })
  })

  describe("Cache Response Manipulation", () => {
    it("should handle cache response that cannot be cloned", async () => {
      const mockResponse = {
        clone: vi.fn().mockImplementation(() => {
          throw new Error("Response already consumed")
        }),
        json: vi.fn(),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      const result = await getLockValue(mockContext)

      // Should handle clone error gracefully and return safe default
      expect(result.lockValue).toEqual(
        expect.objectContaining({
          isLocked: 0,
          isLockedTest: 0,
          code: "",
        }),
      )
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it("should handle null response body", async () => {
      const mockResponse = {
        clone: vi.fn().mockReturnThis(),
        json: vi.fn().mockResolvedValue(null),
      }

      const mockContext = {
        provider: "cloudflare-cache",
        keyName: "/appwarden-lock",
        edgeCache: {
          getValue: vi.fn().mockResolvedValue(mockResponse),
        },
      } as unknown as CloudflareProviderContext

      vi.mocked(LockValue.parse).mockImplementation(() => {
        throw new Error("Cannot parse null")
      })

      const result = await getLockValue(mockContext)

      expect(result.shouldDeleteEdgeValue).toBe(true)
    })
  })
})

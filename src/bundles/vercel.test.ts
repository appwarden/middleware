import { describe, expect, it, vi } from "vitest"

// Mock the debug utility to avoid DEBUG global issues
vi.mock("../utils/debug", () => ({
  debug: vi.fn(),
}))

import { BaseNextJsConfigSchema, withAppwarden } from "./vercel"

describe("vercel bundle", () => {
  describe("withAppwarden export", () => {
    it("should export withAppwarden as a function", () => {
      expect(typeof withAppwarden).toBe("function")
    })

    it("should return a middleware function when called with config", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_test?token=test",
        appwardenApiToken: "test-token",
        vercelApiToken: "vercel-token",
        lockPageSlug: "/maintenance",
      }

      const middleware = withAppwarden(config)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts NextRequest and NextFetchEvent", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_test?token=test",
        appwardenApiToken: "test-token",
        vercelApiToken: "vercel-token",
        lockPageSlug: "/maintenance",
      }

      const middleware = withAppwarden(config)
      // Middleware should accept 2 parameters (req, event)
      expect(middleware.length).toBe(2)
    })
  })

  describe("BaseNextJsConfigSchema export", () => {
    it("should export BaseNextJsConfigSchema as a Zod schema", () => {
      expect(BaseNextJsConfigSchema).toBeDefined()
      expect(typeof BaseNextJsConfigSchema.parse).toBe("function")
      expect(typeof BaseNextJsConfigSchema.safeParse).toBe("function")
    })

    it("should validate a valid config", () => {
      const validConfig = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
        appwardenApiToken: "token123",
        vercelApiToken: "vercel-token",
        lockPageSlug: "maintenance",
      }

      const result = BaseNextJsConfigSchema.safeParse(validConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lockPageSlug).toBe("/maintenance")
      }
    })

    it("should reject invalid config", () => {
      const invalidConfig = {
        // Missing required fields
        lockPageSlug: "/maintenance",
      }

      const result = BaseNextJsConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
    })

    it("should transform lockPageSlug to have leading slash", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
        appwardenApiToken: "token123",
        lockPageSlug: "maintenance",
      }

      const result = BaseNextJsConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lockPageSlug).toBe("/maintenance")
      }
    })
  })
})

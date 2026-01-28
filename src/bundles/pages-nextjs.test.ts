import { describe, expect, it, vi } from "vitest"

// Mock the debug utility to avoid DEBUG global issues
vi.mock("../utils/debug", () => ({
  debug: vi.fn(),
}))

// Mock the @cloudflare/next-on-pages module to avoid module resolution issues
vi.mock("@cloudflare/next-on-pages", () => ({
  getRequestContext: vi.fn(() => ({
    env: {},
    ctx: {},
    cf: {},
  })),
}))

import { withAppwardenOnNextJs } from "./pages-nextjs"

describe("pages-nextjs bundle", () => {
  describe("withAppwardenOnNextJs export", () => {
    it("should export withAppwardenOnNextJs as a function", () => {
      expect(typeof withAppwardenOnNextJs).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const configFn = () => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = withAppwardenOnNextJs(configFn)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts request and event", () => {
      const configFn = () => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = withAppwardenOnNextJs(configFn)
      // Middleware should accept 2 parameters (request, event)
      expect(middleware.length).toBe(2)
    })

    it("should handle invalid config function gracefully", () => {
      const invalidConfigFn = "not a function" as any

      // Should not throw during creation, but during execution
      expect(() => withAppwardenOnNextJs(invalidConfigFn)).not.toThrow()
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  useContentSecurityPolicy,
} from "./cloudflare"

describe("cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a fetch handler when called with config function", () => {
      const configFn = (_context: any) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        middleware: {
          before: [] as any[],
        },
      })

      const handler = createAppwardenMiddleware(configFn as any)
      expect(typeof handler).toBe("function")
    })

    it("should create handler that accepts Request, env, and ctx", () => {
      const configFn = (_context: any) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        middleware: {
          before: [] as any[],
        },
      })

      const handler = createAppwardenMiddleware(configFn as any)
      // Handler should accept 3 parameters (request, env, ctx)
      expect(handler.length).toBe(3)
    })
  })

  describe("useContentSecurityPolicy export", () => {
    it("should export useContentSecurityPolicy as a function", () => {
      expect(typeof useContentSecurityPolicy).toBe("function")
    })

    it("should return a middleware function when called with config", () => {
      const config = {
        mode: "enforced" as const,
        directives: {
          "default-src": ["'self'"],
        },
      }

      const middleware = useContentSecurityPolicy(config)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts context and next", () => {
      const config = {
        mode: "disabled" as const,
      }

      const middleware = useContentSecurityPolicy(config)
      // Middleware should accept 2 parameters (context, next)
      expect(middleware.length).toBe(2)
    })

    it("should throw error for invalid config", () => {
      const invalidConfig = {
        mode: "enforced" as const,
        // Missing required directives
      }

      expect(() => useContentSecurityPolicy(invalidConfig as any)).toThrow()
    })
  })
})

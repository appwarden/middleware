import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type CloudflareContext,
} from "./react-router-cloudflare"

describe("react-router-cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const middleware = createAppwardenMiddleware((_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts args and next parameters", () => {
      const middleware = createAppwardenMiddleware((_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      // Middleware should accept 2 parameters (args, next)
      expect(middleware.length).toBe(2)
    })
  })

  describe("type exports", () => {
    it("should export CloudflareContext type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const context: CloudflareContext = {
        env: {} as CloudflareEnv,
        ctx: {
          waitUntil: () => {},
          passThroughOnException: () => {},
          props: {},
        } as ExecutionContext,
      }
      expect(context.env).toBeDefined()
    })
  })
})

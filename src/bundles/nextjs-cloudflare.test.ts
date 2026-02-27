import { describe, expect, it } from "vitest"
import { createAppwardenMiddleware } from "./nextjs-cloudflare"

describe("nextjs-cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const middleware = createAppwardenMiddleware((_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts request and event", () => {
      const middleware = createAppwardenMiddleware((_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      // Middleware should accept 2 parameters (request, event)
      expect(middleware.length).toBe(2)
    })
  })
})

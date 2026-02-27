import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type TanStackStartCloudflareContext,
} from "./tanstack-start-cloudflare"

describe("tanstack-start-cloudflare bundle", () => {
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

    it("should create middleware that accepts args parameter", () => {
      const middleware = createAppwardenMiddleware((_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      // Middleware should accept 1 parameter (args object)
      expect(middleware.length).toBe(1)
    })
  })

  describe("type exports", () => {
    it("should export TanStackStartCloudflareContext type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const context: TanStackStartCloudflareContext = {
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

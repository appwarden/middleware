import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type AstroAppwardenConfig,
  type AstroCloudflareConfig,
  type AstroCloudflareConfigInput,
  type AstroCloudflareRuntime,
  type AstroConfigFn,
} from "./astro-cloudflare"

describe("astro-cloudflare bundle", () => {
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

    it("should create middleware that accepts context and next", () => {
      const middleware = createAppwardenMiddleware((_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      // Middleware should accept 2 parameters (context, next)
      expect(middleware.length).toBe(2)
    })
  })

  describe("type exports", () => {
    it("should export AstroAppwardenConfig type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: AstroAppwardenConfig = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: true,
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

    it("should export AstroCloudflareConfig type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: AstroCloudflareConfig = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: true,
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

    it("should export AstroCloudflareConfigInput type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: AstroCloudflareConfigInput = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: "true", // Input type accepts string
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

    it("should export AstroConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: AstroConfigFn = (_runtime: AstroCloudflareRuntime) => ({
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })
      expect(typeof configFn).toBe("function")
    })
  })
})

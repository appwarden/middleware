import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type NextJsCloudflareAppwardenConfig,
  type NextJsCloudflareConfigFn,
  type NextJsCloudflareRuntime,
  type NextJsMiddlewareFunction,
} from "./nextjs-cloudflare"

describe("nextjs-cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const configFn: NextJsCloudflareConfigFn = (_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts request and event", () => {
      const configFn: NextJsCloudflareConfigFn = (_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      // Middleware should accept 2 parameters (request, event)
      expect(middleware.length).toBe(2)
    })
  })

  describe("type exports", () => {
    it("should export NextJsCloudflareAppwardenConfig type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: NextJsCloudflareAppwardenConfig = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: true,
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

    it("should export NextJsCloudflareRuntime type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const runtime: NextJsCloudflareRuntime = {
        env: {} as CloudflareEnv,
        ctx: {
          waitUntil: () => {},
          passThroughOnException: () => {},
          props: {},
        } as ExecutionContext,
      }
      expect(runtime.env).toBeDefined()
    })

    it("should export NextJsCloudflareConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: NextJsCloudflareConfigFn = (_runtime) => ({
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })
      expect(typeof configFn).toBe("function")
    })

    it("should export NextJsMiddlewareFunction type", () => {
      // Type check - ensure the type is exported correctly
      // The actual function shape is tested at compile time via the type import
      const fn: NextJsMiddlewareFunction =
        (() => {}) as unknown as NextJsMiddlewareFunction
      expect(fn).toBeDefined()
    })
  })
})

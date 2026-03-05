import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type NextJsCloudflareAppwardenConfig,
  type NextJsCloudflareConfig,
  type NextJsCloudflareConfigFn,
  type NextJsCloudflareConfigInput,
  type NextJsCloudflareRuntime,
  type NextJsMiddlewareFunction,
} from "./nextjs-cloudflare"

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

    it("should export NextJsCloudflareConfig type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: NextJsCloudflareConfig = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: true,
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

    it("should export NextJsCloudflareConfigInput type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: NextJsCloudflareConfigInput = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: "true", // Input type accepts string
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

    it("should export NextJsCloudflareConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: NextJsCloudflareConfigFn = (
        _runtime: NextJsCloudflareRuntime,
      ) => ({
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })
      expect(typeof configFn).toBe("function")
    })

    it("should export NextJsMiddlewareFunction type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const middleware: NextJsMiddlewareFunction = async () => {
        const { NextResponse } = await import("next/server")
        return NextResponse.next()
      }
      expect(typeof middleware).toBe("function")
    })
  })
})

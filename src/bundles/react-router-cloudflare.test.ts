import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type ReactRouterConfigFn,
  type ReactRouterMiddlewareArgs,
  type ReactRouterMiddlewareFunction,
} from "./react-router-cloudflare"

describe("react-router-cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const middleware = createAppwardenMiddleware(() => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts args and next parameters", () => {
      const middleware = createAppwardenMiddleware(() => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      }))

      // Middleware should accept 2 parameters (args, next)
      expect(middleware.length).toBe(2)
    })
  })

  describe("type exports", () => {
    it("should export ReactRouterConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: ReactRouterConfigFn = () => ({
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })
      expect(typeof configFn).toBe("function")
    })

    it("should export ReactRouterMiddlewareArgs type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const args: ReactRouterMiddlewareArgs = {
        request: new Request("https://example.com"),
        params: {},
      }
      expect(args.request).toBeDefined()
      expect(args.params).toBeDefined()
    })

    it("should export ReactRouterMiddlewareFunction type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const middleware: ReactRouterMiddlewareFunction = async (args, next) => {
        return next()
      }
      expect(typeof middleware).toBe("function")
    })
  })
})

// Import and test config types from schema
import type {
  ReactRouterAppwardenConfigInput,
  ReactRouterCloudflareConfig,
} from "./react-router-cloudflare"

describe("react-router-cloudflare config type exports", () => {
  it("should export ReactRouterCloudflareConfig type", () => {
    // Type check - this will fail at compile time if the type is not exported
    const config: ReactRouterCloudflareConfig = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
      debug: true,
    }
    expect(config.lockPageSlug).toBe("/maintenance")
  })

  it("should export ReactRouterAppwardenConfigInput type", () => {
    // Type check - this will fail at compile time if the type is not exported
    const config: ReactRouterAppwardenConfigInput = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
      debug: "true", // Input type accepts string
    }
    expect(config.lockPageSlug).toBe("/maintenance")
  })
})

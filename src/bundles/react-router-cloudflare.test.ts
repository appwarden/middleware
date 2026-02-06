import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type CloudflareContext,
  type ReactRouterAppwardenConfig,
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
      const configFn: ReactRouterConfigFn = (_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts args and next parameters", () => {
      const configFn: ReactRouterConfigFn = (_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      // Middleware should accept 2 parameters (args, next)
      expect(middleware.length).toBe(2)
    })
  })

  describe("type exports", () => {
    it("should export ReactRouterAppwardenConfig type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: ReactRouterAppwardenConfig = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: true,
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

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

    it("should export ReactRouterConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: ReactRouterConfigFn = (_cloudflare) => ({
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
        context: {
          cloudflare: {
            env: {} as CloudflareEnv,
            ctx: {
              waitUntil: () => {},
              passThroughOnException: () => {},
              props: {},
            } as ExecutionContext,
          },
        },
      }
      expect(args.request).toBeDefined()
    })

    it("should export ReactRouterMiddlewareFunction type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const middlewareFn: ReactRouterMiddlewareFunction = async (_args) => {
        return new Response("OK")
      }
      expect(typeof middlewareFn).toBe("function")
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type AstroAppwardenConfig,
  type AstroCloudflareRuntime,
  type AstroConfigFn,
  type AstroMiddlewareContext,
  type AstroMiddlewareFunction,
} from "./astro-cloudflare"

describe("astro-cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const configFn: AstroConfigFn = (_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts context and next", () => {
      const configFn: AstroConfigFn = (_runtime) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
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

    it("should export AstroCloudflareRuntime type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const runtime: AstroCloudflareRuntime = {
        env: {} as CloudflareEnv,
        ctx: {
          waitUntil: () => {},
          passThroughOnException: () => {},
          props: {},
        } as ExecutionContext,
      }
      expect(runtime.env).toBeDefined()
    })

    it("should export AstroConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: AstroConfigFn = (_runtime) => ({
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })
      expect(typeof configFn).toBe("function")
    })

    it("should export AstroMiddlewareContext type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const context: AstroMiddlewareContext = {
        request: new Request("https://example.com"),
        locals: {
          runtime: {
            env: {} as CloudflareEnv,
            ctx: {
              waitUntil: () => {},
              passThroughOnException: () => {},
              props: {},
            } as ExecutionContext,
          },
        },
        redirect: (_path: string, _status?: number) => new Response(),
      }
      expect(context.request).toBeDefined()
    })

    it("should export AstroMiddlewareFunction type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const middlewareFn: AstroMiddlewareFunction = async (_context, next) => {
        return next()
      }
      expect(typeof middlewareFn).toBe("function")
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  type TanStackStartAppwardenConfig,
  type TanStackStartCloudflareContext,
  type TanStackStartConfigFn,
  type TanStackStartMiddlewareArgs,
  type TanStackStartMiddlewareFunction,
  type TanStackStartNextResult,
} from "./tanstack-start-cloudflare"

describe("tanstack-start-cloudflare bundle", () => {
  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config function", () => {
      const configFn: TanStackStartConfigFn = (_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts args parameter", () => {
      const configFn: TanStackStartConfigFn = (_cloudflare) => ({
        debug: true,
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })

      const middleware = createAppwardenMiddleware(configFn)
      // Middleware should accept 1 parameter (args object)
      expect(middleware.length).toBe(1)
    })
  })

  describe("type exports", () => {
    it("should export TanStackStartAppwardenConfig type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const config: TanStackStartAppwardenConfig = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        debug: true,
      }
      expect(config.lockPageSlug).toBe("/maintenance")
    })

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

    it("should export TanStackStartConfigFn type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const configFn: TanStackStartConfigFn = (_cloudflare) => ({
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
      })
      expect(typeof configFn).toBe("function")
    })

    it("should export TanStackStartMiddlewareArgs type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const argsRequest = new Request("https://example.com")
      const argsContext = {
        cloudflare: {
          env: {} as CloudflareEnv,
          ctx: {
            waitUntil: () => {},
            passThroughOnException: () => {},
            props: {},
          } as ExecutionContext,
        },
      }

      const args: TanStackStartMiddlewareArgs = {
        request: argsRequest,
        pathname: "/",
        next: async (): Promise<TanStackStartNextResult> => ({
          request: argsRequest,
          context: argsContext as Record<string, unknown>,
          response: new Response("OK"),
          pathname: "/",
        }),
        context: argsContext as TanStackStartMiddlewareArgs["context"],
      }
      expect(args.request).toBeDefined()
    })

    it("should export TanStackStartMiddlewareFunction type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const middlewareFn: TanStackStartMiddlewareFunction = async (
        args: Parameters<TanStackStartMiddlewareFunction>[0],
      ) => ({
        request: args.request,
        context: args.context,
        response: new Response("OK"),
        pathname: "/",
      })
      expect(typeof middlewareFn).toBe("function")
    })
  })
})

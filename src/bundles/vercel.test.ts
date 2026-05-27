import { describe, expect, it } from "vitest"
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
  type VercelMiddlewareFunction,
} from "./vercel"

describe("vercel bundle", () => {
  // Valid Upstash URL for testing
  const validUpstashUrl = "rediss://:password@hostname.upstash.io:6379"

  describe("createAppwardenMiddleware export", () => {
    it("should export createAppwardenMiddleware as a function", () => {
      expect(typeof createAppwardenMiddleware).toBe("function")
    })

    it("should return a middleware function when called with config", () => {
      const config = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        cacheUrl: validUpstashUrl,
      }

      const middleware = createAppwardenMiddleware(config)
      expect(typeof middleware).toBe("function")
    })

    it("should create middleware that accepts request parameter", () => {
      const config = {
        lockPageSlug: "/maintenance",
        appwardenApiToken: "test-token",
        cacheUrl: validUpstashUrl,
      }

      const middleware = createAppwardenMiddleware(config)
      // Middleware should accept 1 parameter (request)
      expect(middleware.length).toBe(1)
    })
  })

  describe("type exports", () => {
    it("should export VercelMiddlewareFunction type", () => {
      // Type check - this will fail at compile time if the type is not exported
      const middlewareFn: VercelMiddlewareFunction = async (_request) => {
        return new Response("OK")
      }
      expect(typeof middlewareFn).toBe("function")
    })
  })

  describe("getAppwardenConfiguration export", () => {
    it("should export getAppwardenConfiguration as a function", () => {
      expect(typeof getAppwardenConfiguration).toBe("function")
    })

    it("should return a valid config when call-site config is provided", () => {
      const config = getAppwardenConfiguration(
        {},
        {
          lockPageSlug: "/maintenance",
          appwardenApiToken: "test-token",
          cacheUrl: validUpstashUrl,
        },
      )

      expect(config.lockPageSlug).toBe("/maintenance")
      expect(config.appwardenApiToken).toBe("test-token")
    })

    it("should throw when required fields are missing", () => {
      expect(() =>
        getAppwardenConfiguration({}, {
          lockPageSlug: "/maintenance",
        } as any),
      ).toThrow()
    })
  })
})

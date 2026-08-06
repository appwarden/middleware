import { describe, expect, it } from "vitest"
import {
  pathMatchesAnyPattern,
  pathMatchesPattern,
  resolveMiddlewareConfig,
} from "./route-matching"

describe("pathMatchesPattern", () => {
  it.each([
    ["/api", "/api", true],
    ["/api/users", "/api", true],
    ["/api-docs", "/api", false],
    ["/api", "/api/users", false],
    ["/health", "/health", true],
    ["/health/check", "/health", true],
    ["/healthcare", "/health", false],
    ["/api/webhooks/123", "/api/webhooks/*", true],
    ["/api/webhooks/123/456", "/api/webhooks/*", true],
    ["/api/webhooks-other", "/api/webhooks/*", false],
    ["/api/", "/api/", true],
    ["/api/users", "/api/", true],
    ["/api-docs", "/api/", false],
    ["/", "/", true],
    ["/anything", "/", true],
  ])("pathMatchesPattern(%s, %s) -> %s", (requestPath, pattern, expected) => {
    expect(pathMatchesPattern(requestPath, pattern)).toBe(expected)
  })
})

describe("pathMatchesAnyPattern", () => {
  it("returns true when any pattern matches", () => {
    expect(pathMatchesAnyPattern("/api/users", ["/health", "/api"])).toBe(true)
  })

  it("returns false when no pattern matches", () => {
    expect(pathMatchesAnyPattern("/api-docs", ["/health", "/api"])).toBe(false)
  })
})

describe("resolveMiddlewareConfig", () => {
  it("resolves legacy top-level config", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        lockPageSlug: "/maintenance",
      },
      "example.com",
    )

    expect(result).toEqual({
      debug: false,
      bypassPaths: undefined,
      website: {
        lockPageSlug: "/maintenance",
        cspMode: undefined,
        cspDirectives: undefined,
      },
      api: undefined,
    })
  })

  it("resolves legacy multidomain config", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        lockPageSlug: "/maintenance",
        multidomainConfig: {
          "example.com": {
            lockPageSlug: "/maintenance-example",
            debug: true,
          },
        },
      },
      "example.com",
    )

    expect(result).toEqual({
      debug: true,
      bypassPaths: undefined,
      website: {
        lockPageSlug: "/maintenance-example",
        cspMode: undefined,
        cspDirectives: undefined,
      },
      api: undefined,
    })
  })

  it("falls back to root lockPageSlug for unconfigured legacy domains", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        lockPageSlug: "/maintenance",
      },
      "unknown.com",
    )

    expect(result).toBeDefined()
    expect(result?.website?.lockPageSlug).toBe("/maintenance")
  })

  it("resolves new route-based config by hostname", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        appwardenMiddleware: [
          {
            url: "example.com",
            options: {
              debug: true,
              bypassPaths: ["/health"],
              website: { lockPageSlug: "/maintenance" },
              api: { basePaths: ["/api"] },
            },
          },
        ],
      },
      "example.com",
    )

    expect(result).toEqual({
      debug: true,
      bypassPaths: ["/health"],
      website: { lockPageSlug: "/maintenance" },
      api: { basePaths: ["/api"] },
    })
  })

  it("matches www variant for route-based config", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        appwardenMiddleware: [
          {
            url: "example.com",
            options: {
              website: { lockPageSlug: "/maintenance" },
            },
          },
        ],
      },
      "www.example.com",
    )

    expect(result?.website?.lockPageSlug).toBe("/maintenance")
  })

  it("returns undefined when no route-based hostname matches", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        appwardenMiddleware: [
          {
            url: "example.com",
            options: {
              website: { lockPageSlug: "/maintenance" },
            },
          },
        ],
      },
      "other.com",
    )

    expect(result).toBeUndefined()
  })
})

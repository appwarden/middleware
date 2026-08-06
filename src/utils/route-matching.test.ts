import { describe, expect, it } from "vitest"
import {
  buildApiLockResponseHeaders,
  findMiddlewareConfigForHostname,
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

describe("findMiddlewareConfigForHostname", () => {
  const middleware = [
    {
      url: "example.com",
      options: { website: { lockPageSlug: "/maintenance" } },
    },
    {
      url: "www.other.com",
      options: { website: { lockPageSlug: "/other" } },
    },
  ]

  it("returns the entry on an exact hostname match", () => {
    expect(findMiddlewareConfigForHostname(middleware, "example.com")).toEqual(
      middleware[0],
    )
  })

  it("matches a non-www request against a www entry", () => {
    expect(findMiddlewareConfigForHostname(middleware, "other.com")).toEqual(
      middleware[1],
    )
  })

  it("matches a www request against a non-www entry", () => {
    expect(
      findMiddlewareConfigForHostname(middleware, "www.example.com"),
    ).toEqual(middleware[0])
  })

  it("normalizes hostnames to lowercase", () => {
    expect(findMiddlewareConfigForHostname(middleware, "EXAMPLE.COM")).toEqual(
      middleware[0],
    )
  })

  it("returns undefined when no entry matches", () => {
    expect(
      findMiddlewareConfigForHostname(middleware, "unknown.com"),
    ).toBeUndefined()
  })
})

describe("buildApiLockResponseHeaders", () => {
  it("returns an empty Headers object when headers are undefined", () => {
    const headers = buildApiLockResponseHeaders(undefined)
    expect(headers).toBeInstanceOf(Headers)
    expect(Array.from(headers.entries())).toEqual([])
  })

  it("returns an empty Headers object for an empty header array", () => {
    const headers = buildApiLockResponseHeaders([])
    expect(Array.from(headers.entries())).toEqual([])
  })

  it("sets the provided headers on the returned Headers object", () => {
    const headers = buildApiLockResponseHeaders([
      { name: "Content-Type", value: "application/json" },
      { name: "X-Custom", value: "value" },
    ])

    expect(headers.get("Content-Type")).toBe("application/json")
    expect(headers.get("X-Custom")).toBe("value")
  })

  it("overwrites earlier headers when the same name is used more than once", () => {
    const headers = buildApiLockResponseHeaders([
      { name: "X-Custom", value: "first" },
      { name: "X-Custom", value: "second" },
    ])

    expect(headers.get("X-Custom")).toBe("second")
  })
})

describe("resolveMiddlewareConfig edge cases", () => {
  it("falls back to legacy config when appwardenMiddleware is empty", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        lockPageSlug: "/maintenance",
        appwardenMiddleware: [],
      },
      "example.com",
    )

    expect(result?.website?.lockPageSlug).toBe("/maintenance")
  })

  it("returns undefined for legacy config when no lockPageSlug is available", () => {
    expect(
      resolveMiddlewareConfig(
        {
          debug: false,
        },
        "example.com",
      ),
    ).toBeUndefined()
  })

  it("uses multidomain contentSecurityPolicy settings", () => {
    const result = resolveMiddlewareConfig(
      {
        debug: false,
        lockPageSlug: "/maintenance",
        multidomainConfig: {
          "example.com": {
            lockPageSlug: "/maintenance-example",
            contentSecurityPolicy: {
              mode: "enforced",
              directives: { "default-src": ["'self'"] },
            },
          },
        },
      },
      "example.com",
    )

    expect(result).toEqual({
      debug: false,
      bypassPaths: undefined,
      website: {
        lockPageSlug: "/maintenance-example",
        cspMode: "enforced",
        cspDirectives: { "default-src": ["'self'"] },
      },
      api: undefined,
    })
  })
})

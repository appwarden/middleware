import { describe, expect, it } from "vitest"
import {
  matchesAnyPath,
  matchesSegmentBoundaryPath,
  resolveMiddlewareAction,
} from "./route-matching"

describe("matchesSegmentBoundaryPath", () => {
  it("matches exact paths", () => {
    expect(matchesSegmentBoundaryPath("/health", "/health")).toBe(true)
    expect(matchesSegmentBoundaryPath("/api", "/api")).toBe(true)
  })

  it("matches subpaths at segment boundaries", () => {
    expect(matchesSegmentBoundaryPath("/api/users", "/api")).toBe(true)
    expect(matchesSegmentBoundaryPath("/api/users/123", "/api")).toBe(true)
  })

  it("does not match sibling paths", () => {
    expect(matchesSegmentBoundaryPath("/api-docs", "/api")).toBe(false)
    expect(matchesSegmentBoundaryPath("/apiv2", "/api")).toBe(false)
  })

  it("normalizes trailing wildcard to match the prefix and itself", () => {
    expect(matchesSegmentBoundaryPath("/api", "/api/*")).toBe(true)
    expect(matchesSegmentBoundaryPath("/api/users", "/api/*")).toBe(true)
  })

  it("matches all subpaths when pattern is the root", () => {
    expect(matchesSegmentBoundaryPath("/", "/")).toBe(true)
    expect(matchesSegmentBoundaryPath("/foo", "/")).toBe(true)
    expect(matchesSegmentBoundaryPath("/foo/bar", "/")).toBe(true)
  })
})

describe("matchesAnyPath", () => {
  it("returns false when no patterns are provided", () => {
    expect(matchesAnyPath("/api", undefined)).toBe(false)
    expect(matchesAnyPath("/api", [])).toBe(false)
  })

  it("returns true when any pattern matches", () => {
    expect(matchesAnyPath("/health", ["/api", "/health"])).toBe(true)
  })
})

describe("resolveMiddlewareAction", () => {
  const apiResponse = { status: 503, body: '{"error":"Service unavailable"}' }

  it("returns bypass when path matches bypassPaths", () => {
    const request = new Request("https://example.com/health")
    const options = {
      debug: false,
      bypassPaths: ["/health"],
      api: { basePaths: ["/health"], response: apiResponse },
      website: { lockPageSlug: "/maintenance" },
    }

    expect(resolveMiddlewareAction(request, options)).toBe("bypass")
  })

  it("returns api when path matches api.basePaths and no bypass match", () => {
    const request = new Request("https://example.com/api/users")
    const options = {
      debug: false,
      bypassPaths: ["/health"],
      api: { basePaths: ["/api"], response: apiResponse },
      website: { lockPageSlug: "/maintenance" },
    }

    expect(resolveMiddlewareAction(request, options)).toBe("api")
  })

  it("returns website when website is configured and no bypass/api match", () => {
    const request = new Request("https://example.com/page")
    const options = {
      debug: false,
      bypassPaths: ["/api"],
      api: { basePaths: ["/api"], response: apiResponse },
      website: { lockPageSlug: "/maintenance" },
    }

    expect(resolveMiddlewareAction(request, options)).toBe("website")
  })

  it("returns null when neither website nor api is configured", () => {
    const request = new Request("https://example.com/page")
    const options = {
      debug: false,
      bypassPaths: ["/api"],
    }

    expect(resolveMiddlewareAction(request, options)).toBe(null)
  })

  it("/api matches /api/users but not /api-docs", () => {
    const options = {
      debug: false,
      api: { basePaths: ["/api"], response: apiResponse },
    }

    expect(
      resolveMiddlewareAction(
        new Request("https://example.com/api/users"),
        options,
      ),
    ).toBe("api")
    expect(
      resolveMiddlewareAction(new Request("https://example.com/api"), options),
    ).toBe("api")
    expect(
      resolveMiddlewareAction(
        new Request("https://example.com/api-docs"),
        options,
      ),
    ).toBe(null)
  })

  it("/api/* matches /api/users and /api itself", () => {
    const options = {
      debug: false,
      api: { basePaths: ["/api/*"], response: apiResponse },
    }

    expect(
      resolveMiddlewareAction(
        new Request("https://example.com/api/users"),
        options,
      ),
    ).toBe("api")
    expect(
      resolveMiddlewareAction(new Request("https://example.com/api"), options),
    ).toBe("api")
  })
})

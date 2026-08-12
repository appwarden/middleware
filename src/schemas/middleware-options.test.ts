import { describe, expect, it } from "vitest"
import {
  MiddlewareOptionsSchema,
  PathPatternSchema,
  WebsiteMiddlewareConfigSchema,
} from "./middleware-options"

describe("PathPatternSchema", () => {
  it.each(["/api", "/api/*", "/api/users/123", "/"])(
    "accepts a valid path pattern: %s",
    (pattern) => {
      expect(PathPatternSchema.safeParse(pattern).success).toBe(true)
    },
  )

  it.each([
    "api",
    "https://example.com/api",
    "/api?query=1",
    "/api#fragment",
    "",
  ])("rejects an invalid path pattern: %s", (pattern) => {
    const result = PathPatternSchema.safeParse(pattern)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Path pattern must be a valid absolute path starting with /",
      )
    }
  })
})

describe("WebsiteMiddlewareConfigSchema", () => {
  it("rejects an invalid JSON string for cspDirectives", () => {
    const result = WebsiteMiddlewareConfigSchema.safeParse({
      lockPageSlug: "/maintenance",
      cspDirectives: '{"default-src": ["\'self\'"}',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Failed to parse `CSP_DIRECTIVES`",
      )
    }
  })
})

describe("MiddlewareOptionsSchema", () => {
  it("rejects invalid bypassPaths", () => {
    const result = MiddlewareOptionsSchema.safeParse({
      bypassPaths: ["api", "/api?query=1"],
    })

    expect(result.success).toBe(false)
  })
})

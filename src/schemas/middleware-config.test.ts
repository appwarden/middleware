import { describe, expect, it } from "vitest"
import {
  ApiMiddlewareConfigSchema,
  WebsiteMiddlewareConfigSchema,
} from "./middleware-config"

describe("WebsiteMiddlewareConfigSchema", () => {
  it("parses a valid JSON string for cspDirectives", () => {
    const result = WebsiteMiddlewareConfigSchema.safeParse({
      lockPageSlug: "/maintenance",
      cspDirectives: '{"default-src": ["\'self\'"]}',
    })

    expect(result.success).toBe(true)
    expect(result.data?.cspDirectives).toEqual({
      "default-src": ["'self'"],
    })
  })

  it("accepts an object for cspDirectives", () => {
    const result = WebsiteMiddlewareConfigSchema.safeParse({
      lockPageSlug: "/maintenance",
      cspDirectives: { "default-src": ["'self'"] },
    })

    expect(result.success).toBe(true)
    expect(result.data?.cspDirectives).toEqual({
      "default-src": ["'self'"],
    })
  })

  it("rejects an invalid JSON string for cspDirectives", () => {
    const result = WebsiteMiddlewareConfigSchema.safeParse({
      lockPageSlug: "/maintenance",
      cspDirectives: '{"default-src": ["\'self\'"}',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "cspDirectives must be a valid JSON string",
      )
    }
  })
})

describe("ApiMiddlewareConfigSchema", () => {
  it('defaults basePaths to ["/"] when omitted', () => {
    const result = ApiMiddlewareConfigSchema.safeParse({
      response: { status: 503, body: "Service unavailable" },
    })

    expect(result.success).toBe(true)
    expect(result.data?.basePaths).toEqual(["/"])
  })

  it("preserves explicit basePaths when provided", () => {
    const result = ApiMiddlewareConfigSchema.safeParse({
      basePaths: ["/api", "/internal"],
    })

    expect(result.success).toBe(true)
    expect(result.data?.basePaths).toEqual(["/api", "/internal"])
  })
})

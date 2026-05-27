import { describe, expect, it } from "vitest"
import { mergeAdapterConfig } from "./get-appwarden-configuration"

describe("mergeAdapterConfig", () => {
  it("should use call-site values over generated", () => {
    const result = mergeAdapterConfig(
      { lockPageSlug: "/old", debug: false },
      { lockPageSlug: "/new", debug: true },
    )
    expect(result.lockPageSlug).toBe("/new")
    expect(result.debug).toBe(true)
  })

  it("should preserve generated fields not in call-site", () => {
    const result = mergeAdapterConfig(
      { lockPageSlug: "/old", appwardenApiHostname: "https://api.example.com" },
      { debug: true },
    )
    expect(result.lockPageSlug).toBe("/old")
    expect(result.appwardenApiHostname).toBe("https://api.example.com")
    expect(result.debug).toBe(true)
  })

  it("should deep-merge contentSecurityPolicy directives", () => {
    const result = mergeAdapterConfig(
      {
        contentSecurityPolicy: {
          mode: "enforced",
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "{{nonce}}"],
          },
        },
      },
      {
        contentSecurityPolicy: {
          directives: {
            "style-src": ["'self'"],
          },
        },
      },
    )

    expect(result.contentSecurityPolicy).toEqual({
      mode: "enforced",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "{{nonce}}"],
        "style-src": ["'self'"],
      },
    })
  })

  it("should let call-site CSP mode override generated", () => {
    const result = mergeAdapterConfig(
      {
        contentSecurityPolicy: {
          mode: "enforced",
          directives: { "default-src": ["'self'"] },
        },
      },
      {
        contentSecurityPolicy: {
          mode: "report-only",
          directives: {},
        },
      },
    )

    expect(result.contentSecurityPolicy).toEqual({
      mode: "report-only",
      directives: { "default-src": ["'self'"] },
    })
  })

  it("should deep-merge with empty call-site directives (generated preserved)", () => {
    const result = mergeAdapterConfig(
      {
        contentSecurityPolicy: {
          mode: "enforced",
          directives: {
            "default-src": ["'self'"],
          },
        },
      },
      {
        contentSecurityPolicy: {
          directives: {},
        },
      },
    )

    expect(result.contentSecurityPolicy).toEqual({
      mode: "enforced",
      directives: {
        "default-src": ["'self'"],
      },
    })
  })

  it("should handle empty generated config", () => {
    const result = mergeAdapterConfig(
      {},
      { lockPageSlug: "/lock", debug: true },
    )
    expect(result.lockPageSlug).toBe("/lock")
    expect(result.debug).toBe(true)
  })

  it("should handle empty call-site config", () => {
    const result = mergeAdapterConfig({ lockPageSlug: "/lock" }, {})
    expect(result.lockPageSlug).toBe("/lock")
  })
})

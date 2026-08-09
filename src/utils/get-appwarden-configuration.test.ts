import { describe, expect, it } from "vitest"
import {
  mergeAdapterConfig,
  normalizeRouteBasedAdapterConfig,
} from "./get-appwarden-configuration"

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

  it("should not overwrite generated values with undefined call-site values", () => {
    const result = mergeAdapterConfig(
      { lockPageSlug: "/lock", debug: true },
      { lockPageSlug: undefined, debug: false },
    )
    expect(result.lockPageSlug).toBe("/lock")
    expect(result.debug).toBe(false)
  })

  it("should not create invalid CSP when call-site has contentSecurityPolicy: undefined", () => {
    const result = mergeAdapterConfig(
      { lockPageSlug: "/lock" },
      { contentSecurityPolicy: undefined },
    )
    expect(result.contentSecurityPolicy).toBeUndefined()
  })
})

describe("normalizeRouteBasedAdapterConfig", () => {
  it("should return legacy flat config unchanged", () => {
    const generated = {
      lockPageSlug: "/maintenance",
      debug: true,
      appwardenApiHostname: "https://api.appwarden.io",
      contentSecurityPolicy: {
        mode: "enforced" as const,
        directives: { "default-src": ["'self'"] },
      },
    }

    expect(normalizeRouteBasedAdapterConfig(generated)).toEqual(generated)
  })

  it("should convert route-based config to flat config", () => {
    const generated = {
      appwardenMiddleware: [
        {
          url: "example.com",
          options: {
            debug: true,
            bypassPaths: [],
            website: {
              lockPageSlug: "/maintenance",
              cspMode: "report-only" as const,
              cspDirectives: {
                "script-src": ["'self'", "{{nonce}}"],
              },
            },
          },
        },
      ],
      appwardenApiHostname: "https://api.appwarden.io",
    }

    const result = normalizeRouteBasedAdapterConfig(generated)

    expect(result).toEqual({
      lockPageSlug: "/maintenance",
      debug: true,
      appwardenApiHostname: "https://api.appwarden.io",
      contentSecurityPolicy: {
        mode: "report-only",
        directives: {
          "script-src": ["'self'", "{{nonce}}"],
        },
      },
    })
  })

  it("should pick the first entry with a website config", () => {
    const generated = {
      appwardenMiddleware: [
        {
          url: "api.example.com",
          options: {
            api: { basePaths: ["/api"] },
          },
        },
        {
          url: "example.com",
          options: {
            website: {
              lockPageSlug: "/maintenance",
              cspMode: "enforced" as const,
              cspDirectives: { "default-src": ["'self'"] },
            },
          },
        },
      ],
      debug: false,
    }

    const result = normalizeRouteBasedAdapterConfig(generated)

    expect(result.lockPageSlug).toBe("/maintenance")
    expect(result.debug).toBe(false)
  })

  it("should fall back to the first entry when no entry has a website config", () => {
    const generated = {
      appwardenMiddleware: [
        {
          url: "api.example.com",
          options: {
            api: { basePaths: ["/api"] },
          },
        },
      ],
    }

    const result = normalizeRouteBasedAdapterConfig(generated)

    expect(result.appwardenMiddleware).toBeUndefined()
    expect(result.lockPageSlug).toBeUndefined()
  })

  it("should prefer entry-level debug over top-level debug", () => {
    const generated = {
      appwardenMiddleware: [
        {
          url: "example.com",
          options: {
            debug: true,
            website: {
              lockPageSlug: "/maintenance",
            },
          },
        },
      ],
      debug: false,
    }

    const result = normalizeRouteBasedAdapterConfig(generated)

    expect(result.debug).toBe(true)
  })

  it("should preserve top-level fields when entry-level options are missing them", () => {
    const generated = {
      appwardenMiddleware: [
        {
          url: "example.com",
          options: {
            website: {
              lockPageSlug: "/maintenance",
              cspMode: "enforced" as const,
              cspDirectives: { "default-src": ["'self'"] },
            },
          },
        },
      ],
      debug: true,
      appwardenApiHostname: "https://api.appwarden.io",
    }

    const result = normalizeRouteBasedAdapterConfig(generated)

    expect(result.debug).toBe(true)
    expect(result.appwardenApiHostname).toBe("https://api.appwarden.io")
  })

  it("should return generated config unchanged when appwardenMiddleware is empty", () => {
    const generated = {
      appwardenMiddleware: [],
      debug: true,
    }

    expect(normalizeRouteBasedAdapterConfig(generated)).toEqual(generated)
  })
})

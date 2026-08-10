import { describe, expect, it } from "vitest"
import {
  appwardenConfigRefinement,
  UseAppwardenInputSchema,
} from "./use-appwarden"

// Instead of mocking, we'll test the behavior of the schema
// This approach is more resilient to implementation changes

describe("UseAppwardenInputSchema", () => {
  it("should validate a valid input", () => {
    const validInput = {
      debug: true,
      website: {
        lockPageSlug: "/maintenance",
        cspMode: "report-only",
        cspDirectives: {
          "default-src": ["'self'"],
        },
      },
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject(validInput)
    }
  })

  it("should validate a valid input with string debug value", () => {
    const validInput = {
      debug: "true",
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debug).toBe(true) // Should be transformed to boolean
      expect(result.data.website?.lockPageSlug).toBe("/maintenance")
      expect(result.data.appwardenApiToken).toBe("token123")
    }
  })

  it("should retain a valid appwardenApiHostname", () => {
    const validInput = {
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
      appwardenApiHostname: "https://api.appwarden.io",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appwardenApiHostname).toBe(
        validInput.appwardenApiHostname,
      )
    }
  })

  it("should accept staging api hostname", () => {
    const validInput = {
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
      appwardenApiHostname: "https://staging-api.appwarden.io",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appwardenApiHostname).toBe(
        validInput.appwardenApiHostname,
      )
    }
  })

  it("should reject an untrusted appwardenApiHostname", () => {
    const invalidInput = {
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
      appwardenApiHostname: "https://api.custom.appwarden.io",
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it("should default debug to false when not provided", () => {
    const validInput = {
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debug).toBe(false)
      expect(result.data.website?.lockPageSlug).toBe("/maintenance")
      expect(result.data.appwardenApiToken).toBe("token123")
    }
  })

  it("should allow website to be optional in base schema", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
    }

    // Base schema allows optional website
    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("should accept multidomainConfig instead of website", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      multidomainConfig: {
        "example.com": { website: { lockPageSlug: "/maintenance-example" } },
        "other.com": { website: { lockPageSlug: "/maintenance-other" } },
      },
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.multidomainConfig).toEqual(
        validInput.multidomainConfig,
      )
    }
  })

  it("should accept a top-level website CSP configuration", () => {
    const validInput = {
      website: {
        lockPageSlug: "/maintenance",
        cspMode: "report-only",
        cspDirectives: {
          "default-src": ["'self'"],
        },
      },
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.website?.cspMode).toBe("report-only")
      expect(result.data.website?.cspDirectives).toEqual(
        validInput.website.cspDirectives,
      )
    }
  })

  it("should require either lockPageSlug or multidomainConfig when using refinement", () => {
    const invalidInput = {
      debug: true,
      appwardenApiToken: "token123",
    }

    const RefinedSchema = appwardenConfigRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it("should pass refinement when website is provided", () => {
    const validInput = {
      debug: true,
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
    }

    const RefinedSchema = appwardenConfigRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("should pass refinement when multidomainConfig is provided", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      multidomainConfig: {
        "example.com": { website: { lockPageSlug: "/maintenance" } },
      },
    }

    const RefinedSchema = appwardenConfigRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("should require appwardenApiToken", () => {
    const invalidInput = {
      debug: true,
      website: { lockPageSlug: "/maintenance" },
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it("should reject empty appwardenApiToken", () => {
    const invalidInput = {
      debug: true,
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "",
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it.each([
    [
      "api.appwarden.io",
      "Invalid `appwardenApiHostname`. Please provide an absolute URL",
    ],
    [
      "http://api.appwarden.io",
      "`appwardenApiHostname` must use the https:// scheme",
    ],
    [
      "https://evil.com",
      "`appwardenApiHostname` must be https://api.appwarden.io or https://staging-api.appwarden.io.",
    ],
  ])("should reject invalid appwardenApiHostname: %s", (hostname, message) => {
    const invalidInput = {
      website: { lockPageSlug: "/maintenance" },
      appwardenApiToken: "token123",
      appwardenApiHostname: hostname,
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) =>
        entry.path.includes("appwardenApiHostname"),
      )
      expect(issue?.message).toContain(message)
    }
  })

  it("should reject invalid lockPageSlug values", () => {
    const invalidInputs = [
      { website: { lockPageSlug: "//evil.com" } },
      { website: { lockPageSlug: "https://evil.com" } },
      { website: { lockPageSlug: "http://evil.com" } },
      { website: { lockPageSlug: "ftp://evil.com" } },
    ]

    for (const invalid of invalidInputs) {
      const input = {
        debug: true,
        appwardenApiToken: "token123",
        ...invalid,
      }
      const result = UseAppwardenInputSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((entry) =>
          entry.path.includes("lockPageSlug"),
        )
        expect(issue?.message).toContain("relative path")
      }
    }
  })

  it("should reject invalid multidomainConfig lockPageSlug values", () => {
    const invalidInput = {
      debug: true,
      appwardenApiToken: "token123",
      multidomainConfig: {
        "example.com": { website: { lockPageSlug: "//evil.com" } },
      },
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) =>
        entry.path.includes("lockPageSlug"),
      )
      expect(issue?.message).toContain("relative path")
    }
  })

  it("should accept route-based middleware config", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      appwardenMiddleware: [
        {
          url: "example.com",
          options: {
            debug: "false",
            bypassPaths: ["/health", "/api/webhooks/*"],
            website: {
              lockPageSlug: "/maintenance",
              cspMode: "report-only",
              cspDirectives: {
                "default-src": ["'self'"],
              },
            },
            api: {
              basePaths: ["/api", "/internal"],
              response: {
                status: 503,
                body: JSON.stringify({ error: "Service unavailable" }),
                headers: [{ name: "content-type", value: "application/json" }],
              },
            },
          },
        },
      ],
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appwardenMiddleware).toHaveLength(1)
      expect(result.data.appwardenMiddleware?.[0].url).toBe("example.com")
      expect(result.data.appwardenMiddleware?.[0].options.debug).toBe(false)
      expect(result.data.appwardenMiddleware?.[0].options.bypassPaths).toEqual([
        "/health",
        "/api/webhooks/*",
      ])
      expect(
        result.data.appwardenMiddleware?.[0].options.website?.cspDirectives,
      ).toEqual({
        "default-src": ["'self'"],
      })
      expect(
        result.data.appwardenMiddleware?.[0].options.api?.basePaths,
      ).toEqual(["/api", "/internal"])
      expect(
        result.data.appwardenMiddleware?.[0].options.api?.response?.headers,
      ).toEqual([{ name: "content-type", value: "application/json" }])
    }
  })

  it("should pass refinement when route-based middleware config is provided", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      appwardenMiddleware: [
        {
          url: "example.com",
          options: {
            website: { lockPageSlug: "/maintenance" },
          },
        },
      ],
    }

    const RefinedSchema = lockPageSlugRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('should default api.basePaths to ["/"] when omitted in route-based config', () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      appwardenMiddleware: [
        {
          url: "example.com",
          options: {
            api: {},
          },
        },
      ],
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(
        result.data.appwardenMiddleware?.[0].options.api?.basePaths,
      ).toEqual(["/"])
    }
  })
})

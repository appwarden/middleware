import { describe, expect, it } from "vitest"
import { NextJsCloudflareConfigSchema } from "./nextjs-cloudflare"

describe("NextJsCloudflareConfigSchema", () => {
  it("should validate a valid config with all fields", () => {
    const validConfig = {
      appwardenApiToken: "token123",
      appwardenApiHostname: "https://api.appwarden.io",
      debug: true,
      website: {
        lockPageSlug: "/maintenance",
        cspMode: "enforced" as const,
        cspDirectives: {
          "default-src": ["'self'"],
        },
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject(validConfig)
    }
  })

  it("should validate a minimal valid config", () => {
    const minimalConfig = {
      appwardenApiToken: "token123",
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(minimalConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appwardenApiToken).toBe("token123")
      expect(result.data.website?.lockPageSlug).toBe("/maintenance")
      expect(result.data.debug).toBe(false) // Default value
    }
  })

  it("should accept string debug value and transform to boolean", () => {
    const config = {
      appwardenApiToken: "token123",
      debug: "true",
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debug).toBe(true)
    }
  })

  it("should validate a config with api instead of website", () => {
    const config = {
      appwardenApiToken: "token123",
      api: {
        basePaths: ["/api"],
        response: {
          status: 503,
          body: '{"error":"Service unavailable"}',
        },
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.api?.basePaths).toEqual(["/api"])
    }
  })

  it.each([["//evil.com"], ["https://evil.com"], ["http://evil.com"]])(
    "should reject invalid website.lockPageSlug: %s",
    (lockPageSlug: string) => {
      const invalidConfig = {
        appwardenApiToken: "token123",
        website: {
          lockPageSlug,
        },
      }

      const result = NextJsCloudflareConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((entry) =>
          entry.path.includes("lockPageSlug"),
        )
        expect(issue?.message).toContain("relative path")
      }
    },
  )

  it("should reject empty appwardenApiToken with a clear message", () => {
    const invalidConfig = {
      appwardenApiToken: "",
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) =>
        entry.path.includes("appwardenApiToken"),
      )
      expect(issue?.message).toContain(
        "APPWARDEN_API_TOKEN is missing or empty",
      )
      expect((issue as any)?.params).toEqual({
        appwardenErrorKey: "APPWARDEN_API_TOKEN_MISSING",
      })
    }
  })

  it("should reject missing appwardenApiToken with a clear message", () => {
    const invalidConfig = {
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) =>
        entry.path.includes("appwardenApiToken"),
      )
      expect(issue?.message).toContain(
        "APPWARDEN_API_TOKEN is missing or empty",
      )
    }
  })

  it("should reject CSP directives containing {{nonce}} with a clear message", () => {
    const invalidConfig = {
      appwardenApiToken: "token123",
      website: {
        lockPageSlug: "/maintenance",
        cspMode: "enforced" as const,
        cspDirectives: {
          "script-src": ["'self'", "{{nonce}}"],
        },
      },
    }

    const result = NextJsCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) =>
        entry.path.includes("cspDirectives"),
      )
      expect(issue?.message).toContain("Nonce-based CSP is not supported")
      expect((issue as any)?.params).toEqual({
        appwardenErrorKey: "NEXTJS_NONCE_UNSUPPORTED",
      })
    }
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
  ])(
    "should reject invalid appwardenApiHostname: %s",
    (hostname: string, message: string) => {
      const invalidConfig = {
        appwardenApiToken: "token123",
        appwardenApiHostname: hostname,
        website: {
          lockPageSlug: "/maintenance",
        },
      }

      const result = NextJsCloudflareConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((entry) =>
          entry.path.includes("appwardenApiHostname"),
        )
        expect(issue?.message).toContain(message)
      }
    },
  )

  it("should reject invalid debug value", () => {
    const invalidConfig = {
      appwardenApiToken: "token123",
      debug: "not-a-boolean",
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    expect(() => NextJsCloudflareConfigSchema.parse(invalidConfig)).toThrow(
      "Invalid value",
    )
  })
})

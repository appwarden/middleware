import { describe, expect, it } from "vitest"
import { AstroCloudflareConfigSchema } from "./astro-cloudflare"

describe("AstroCloudflareConfigSchema", () => {
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

    const result = AstroCloudflareConfigSchema.safeParse(validConfig)
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

    const result = AstroCloudflareConfigSchema.safeParse(minimalConfig)
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

    const result = AstroCloudflareConfigSchema.safeParse(config)
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

    const result = AstroCloudflareConfigSchema.safeParse(config)
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

      const result = AstroCloudflareConfigSchema.safeParse(invalidConfig)
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((entry) =>
          entry.path.includes("lockPageSlug"),
        )
        expect(issue?.message).toContain("relative path")
      }
    },
  )

  it("should reject missing appwardenApiToken", () => {
    const invalidConfig = {
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    const result = AstroCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
  })

  it("should reject empty appwardenApiToken", () => {
    const invalidConfig = {
      appwardenApiToken: "",
      website: {
        lockPageSlug: "/maintenance",
      },
    }

    const result = AstroCloudflareConfigSchema.safeParse(invalidConfig)
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

      const result = AstroCloudflareConfigSchema.safeParse(invalidConfig)
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

    expect(() => AstroCloudflareConfigSchema.parse(invalidConfig)).toThrow(
      "Invalid value",
    )
  })
})

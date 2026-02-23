import { describe, expect, it } from "vitest"
import {
  AppwardenConfigSchema,
  BaseNextJsConfigSchema,
  VercelCSPSchema,
} from "./vercel"

describe("BaseNextJsConfigSchema", () => {
  it("should validate a valid config", () => {
    const validConfig = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "token123",
      vercelApiToken: "vercel-token",
      lockPageSlug: "maintenance",
    }

    const result = BaseNextJsConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        ...validConfig,
        lockPageSlug: "/maintenance", // Should transform to have leading slash
      })
    }
  })

  it("should transform lockPageSlug to have a leading slash", () => {
    const config = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "token123",
      lockPageSlug: "maintenance",
    }

    const result = BaseNextJsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lockPageSlug).toBe("/maintenance")
    }
  })

  it("should not add an extra slash if lockPageSlug already has one", () => {
    const config = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "token123",
      lockPageSlug: "/maintenance",
    }

    const result = BaseNextJsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lockPageSlug).toBe("/maintenance")
    }
  })

  it("should make vercelApiToken optional", () => {
    const config = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      appwardenApiToken: "token123",
      lockPageSlug: "maintenance",
    }

    const result = BaseNextJsConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it("should require cacheUrl", () => {
    const config = {
      appwardenApiToken: "token123",
      lockPageSlug: "maintenance",
    }

    const result = BaseNextJsConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("cacheUrl")
    }
  })

  it("should require appwardenApiToken", () => {
    const config = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      lockPageSlug: "maintenance",
    }

    const result = BaseNextJsConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("appwardenApiToken")
    }
  })
})

describe("AppwardenConfigSchema", () => {
  describe("cacheUrl validation", () => {
    it("should accept valid Edge Config URL", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
        appwardenApiToken: "token123",
        vercelApiToken: "vercel-token",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it("should accept valid Upstash URL", () => {
      const config = {
        cacheUrl: "redis://:password@funky-roughy-44527.upstash.io:6379",
        appwardenApiToken: "token123",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it("should reject unrecognized cache URL", () => {
      const config = {
        cacheUrl: "https://example.com/cache",
        appwardenApiToken: "token123",
        vercelApiToken: "vercel-token",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("cacheUrl")
        expect(result.error.issues[0].message).toContain("not recognized")
      }
    })

    it("should reject invalid Edge Config URL format", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/config_123?token=abc",
        appwardenApiToken: "token123",
        vercelApiToken: "vercel-token",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("cacheUrl")
        expect(result.error.issues[0].message).toContain("Edge Config")
      }
    })

    it("should reject invalid Upstash URL format", () => {
      const config = {
        cacheUrl: "https://funky-roughy-44527.upstash.io:6379",
        appwardenApiToken: "token123",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("cacheUrl")
        expect(result.error.issues[0].message).toContain("Upstash KV")
      }
    })
  })

  describe("vercelApiToken requirement", () => {
    it("should require vercelApiToken when using Edge Config", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
        appwardenApiToken: "token123",
        lockPageSlug: "maintenance",
        // Missing vercelApiToken
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("vercelApiToken")
        expect(result.error.issues[0].message).toContain(
          "required when using Vercel Edge Config",
        )
      }
    })

    it("should not require vercelApiToken when using Upstash", () => {
      const config = {
        cacheUrl: "redis://:password@funky-roughy-44527.upstash.io:6379",
        appwardenApiToken: "token123",
        lockPageSlug: "maintenance",
        // No vercelApiToken
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })
  })

  describe("appwardenApiToken requirement", () => {
    it("should require appwardenApiToken", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
        vercelApiToken: "vercel-token",
        lockPageSlug: "maintenance",
        // Missing appwardenApiToken
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        const appwardenTokenIssue = result.error.issues.find((issue) =>
          issue.path.includes("appwardenApiToken"),
        )
        expect(appwardenTokenIssue).toBeDefined()
        // When field is missing entirely, Zod returns "Required" message
        expect(appwardenTokenIssue?.message).toBe("Required")
      }
    })

    it("should reject empty appwardenApiToken", () => {
      const config = {
        cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
        appwardenApiToken: "",
        vercelApiToken: "vercel-token",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        const appwardenTokenIssue = result.error.issues.find((issue) =>
          issue.path.includes("appwardenApiToken"),
        )
        expect(appwardenTokenIssue).toBeDefined()
      }
    })
  })

  describe("complete validation flow", () => {
    it("should validate complete Edge Config setup", () => {
      const config = {
        cacheUrl:
          "https://edge-config.vercel.com/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz?token=5010d9a6-04e1-4219-a8b7-f8ecfd3e10d6",
        appwardenApiToken: "appwarden-token-123",
        vercelApiToken: "vercel-token-456",
        lockPageSlug: "/maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.cacheUrl).toBe(config.cacheUrl)
        expect(result.data.appwardenApiToken).toBe(config.appwardenApiToken)
        expect(result.data.vercelApiToken).toBe(config.vercelApiToken)
        expect(result.data.lockPageSlug).toBe("/maintenance")
      }
    })

    it("should validate complete Upstash setup", () => {
      const config = {
        cacheUrl:
          "rediss://:Aa3vAAIjcDFkNWIzYTlkODVhMWY0ZjliOGQzMmUyNmMxZWUxMzcxOXAxMA@funky-roughy-44527.upstash.io:6379",
        appwardenApiToken: "appwarden-token-123",
        lockPageSlug: "maintenance",
      }

      const result = AppwardenConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.cacheUrl).toBe(config.cacheUrl)
        expect(result.data.appwardenApiToken).toBe(config.appwardenApiToken)
        expect(result.data.lockPageSlug).toBe("/maintenance")
      }
    })
  })
})

describe("VercelCSPSchema", () => {
  it("should accept enforced mode with directives", () => {
    const result = VercelCSPSchema.safeParse({
      mode: "enforced",
      directives: { "default-src": ["'self'"] },
    })
    expect(result.success).toBe(true)
  })

  it("should accept report-only mode with directives", () => {
    const result = VercelCSPSchema.safeParse({
      mode: "report-only",
      directives: { "default-src": ["'self'"] },
    })
    expect(result.success).toBe(true)
  })

  it("should accept disabled mode without directives", () => {
    const result = VercelCSPSchema.safeParse({ mode: "disabled" })
    expect(result.success).toBe(true)
  })

  it("should reject enforced mode without directives", () => {
    const result = VercelCSPSchema.safeParse({ mode: "enforced" })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("directives"),
      )
      expect(issue).toBeDefined()
    }
  })

  it("should reject report-only mode without directives", () => {
    const result = VercelCSPSchema.safeParse({ mode: "report-only" })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("directives"),
      )
      expect(issue).toBeDefined()
    }
  })

  it("should reject directives containing {{nonce}} (object form)", () => {
    const result = VercelCSPSchema.safeParse({
      mode: "enforced",
      directives: { "script-src": ["self", "{{nonce}}"] },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "Nonce-based CSP is not supported",
      )
    }
  })

  it("should reject directives containing {{nonce}} (string form)", () => {
    const result = VercelCSPSchema.safeParse({
      mode: "enforced",
      directives: JSON.stringify({ scriptSrc: ["self", "{{nonce}}"] }),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "Nonce-based CSP is not supported",
      )
    }
  })

  it("should reject malformed JSON string directives", () => {
    const result = VercelCSPSchema.safeParse({
      mode: "enforced",
      directives: "not-valid-json",
    })
    expect(result.success).toBe(false)
  })
})

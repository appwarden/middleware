import { describe, expect, it } from "vitest"
import { TanStackStartCloudflareConfigSchema } from "./tanstack-start-cloudflare"

describe("TanStackStartCloudflareConfigSchema", () => {
  it("should validate a valid config with all fields", () => {
    const validConfig = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
      appwardenApiHostname: "https://custom.api.com",
      debug: true,
    }

    const result = TanStackStartCloudflareConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject(validConfig)
    }
  })

  it("should validate a minimal valid config", () => {
    const minimalConfig = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    }

    const result = TanStackStartCloudflareConfigSchema.safeParse(minimalConfig)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.appwardenApiToken).toBe("token123")
      expect(result.data.lockPageSlug).toBe("/maintenance")
      expect(result.data.debug).toBe(false) // Default value
    }
  })

  it("should accept string debug value and transform to boolean", () => {
    const config = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
      debug: "true",
    }

    const result = TanStackStartCloudflareConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debug).toBe(true)
    }
  })

  it("should reject missing lockPageSlug", () => {
    const invalidConfig = {
      appwardenApiToken: "token123",
    }

    const result = TanStackStartCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
  })

  it("should reject missing appwardenApiToken", () => {
    const invalidConfig = {
      lockPageSlug: "/maintenance",
    }

    const result = TanStackStartCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
  })

  it("should reject empty appwardenApiToken", () => {
    const invalidConfig = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "",
    }

    const result = TanStackStartCloudflareConfigSchema.safeParse(invalidConfig)
    expect(result.success).toBe(false)
  })

  it("should reject invalid debug value", () => {
    const invalidConfig = {
      appwardenApiToken: "token123",
      debug: "not-a-boolean",
    }

    expect(() =>
      TanStackStartCloudflareConfigSchema.parse(invalidConfig),
    ).toThrow("Invalid value")
  })
})

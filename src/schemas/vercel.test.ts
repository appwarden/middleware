import { describe, expect, it } from "vitest"
import { BaseNextJsConfigSchema } from "./vercel"

// We'll only test BaseNextJsConfigSchema since it doesn't rely on external functions
// Testing AppwardenConfigSchema would require mocking the utility functions which is complex

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

// Note: We're only testing BaseNextJsConfigSchema since AppwardenConfigSchema
// relies on external utility functions that would need to be mocked.
// In a real-world scenario, we would use a more sophisticated mocking approach
// or integration tests to test AppwardenConfigSchema.

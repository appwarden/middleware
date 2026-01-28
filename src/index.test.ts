import { describe, expect, it } from "vitest"
import * as indexExports from "./index"

describe("index exports", () => {
  it("should export constants with correct values", () => {
    expect(indexExports.APPWARDEN_CACHE_KEY).toBe("appwarden-lock")
    expect(indexExports.APPWARDEN_USER_AGENT).toBe("Appwarden-Monitor")
    expect(indexExports.LOCKDOWN_TEST_EXPIRY_MS).toBe(5 * 60 * 1000) // 5 minutes
  })

  it("should export middlewares as functions", () => {
    expect(typeof indexExports.useContentSecurityPolicy).toBe("function")
  })

  it("should export schemas as objects", () => {
    expect(indexExports.CSPDirectivesSchema).toBeDefined()
    expect(indexExports.CSPDirectivesSchema.parse).toBeDefined()
    expect(indexExports.CSPModeSchema).toBeDefined()
    expect(indexExports.CSPModeSchema.parse).toBeDefined()
  })

  it("should export utility functions", () => {
    expect(typeof indexExports.getEdgeConfigId).toBe("function")
    expect(typeof indexExports.isCacheUrl.edgeConfig).toBe("function")
    expect(typeof indexExports.isCacheUrl.upstash).toBe("function")
    expect(typeof indexExports.isValidCacheUrl.edgeConfig).toBe("function")
    expect(typeof indexExports.isValidCacheUrl.upstash).toBe("function")
  })
})

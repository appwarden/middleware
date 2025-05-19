import { describe, expect, it } from "vitest"
import * as indexExports from "./index"

describe("index exports", () => {
  it("should export constants", () => {
    expect(indexExports.APPWARDEN_CACHE_KEY).toBeDefined()
    expect(indexExports.APPWARDEN_USER_AGENT).toBeDefined()
    expect(indexExports.LOCKDOWN_TEST_EXPIRY_MS).toBeDefined()
  })

  it("should export middlewares", () => {
    expect(indexExports.useContentSecurityPolicy).toBeDefined()
  })

  it("should export schemas", () => {
    expect(indexExports.CSPDirectivesSchema).toBeDefined()
    expect(indexExports.CSPModeSchema).toBeDefined()
  })

  it("should export utility functions", () => {
    expect(indexExports.getEdgeConfigId).toBeDefined()
    expect(indexExports.isCacheUrl).toBeDefined()
    expect(indexExports.isValidCacheUrl).toBeDefined()
  })
})

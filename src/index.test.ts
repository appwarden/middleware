import { describe, expect, it } from "vitest"
import * as indexExports from "./index"

describe("index exports", () => {
  it("should export constants with correct values", () => {
    expect(indexExports.APPWARDEN_CACHE_KEY).toBe("appwarden-lock")
    expect(indexExports.LOCKDOWN_TEST_EXPIRY_MS).toBe(5 * 60 * 1000) // 5 minutes
  })

  it("should export heartbeat route constant", () => {
    expect(indexExports.APPWARDEN_HEARTBEAT_ROUTE).toBe("/_appwarden/heartbeat")
  })

  it("should export heartbeat contract version constant", () => {
    expect(indexExports.HEARTBEAT_CONTRACT_VERSION).toBe(1)
  })

  it("should export heartbeat version max length constant", () => {
    expect(indexExports.HEARTBEAT_VERSION_MAX_LENGTH).toBe(128)
  })

  it("should export heartbeat config error max count constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_COUNT).toBe(10)
  })

  it("should export heartbeat config error max path depth constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH).toBe(10)
  })

  it("should export heartbeat config error max code length constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH).toBe(100)
  })

  it("should export heartbeat config error max message length constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH).toBe(500)
  })

  it("should export heartbeat config errors max serialized bytes constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES).toBe(
      12 * 1024,
    )
  })

  it("should export heartbeat response body max serialized bytes constant", () => {
    expect(indexExports.HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES).toBe(
      32 * 1024,
    )
  })

  it("should export heartbeat config error max path segment length constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH).toBe(
      100,
    )
  })

  it("should export heartbeat service values array", () => {
    expect(indexExports.HEARTBEAT_SERVICE_VALUES).toEqual([
      "cloudflare",
      "cloudflare-astro",
      "cloudflare-react-router",
      "cloudflare-tanstack-start",
      "cloudflare-nextjs",
      "vercel",
    ])
  })

  it("should export heartbeat services object", () => {
    expect(indexExports.HEARTBEAT_SERVICES).toEqual({
      CLOUDFLARE: "cloudflare",
      CLOUDFLARE_ASTRO: "cloudflare-astro",
      CLOUDFLARE_REACT_ROUTER: "cloudflare-react-router",
      CLOUDFLARE_TANSTACK_START: "cloudflare-tanstack-start",
      CLOUDFLARE_NEXTJS: "cloudflare-nextjs",
      VERCEL: "vercel",
    })
  })

  it("should not export middlewares from the root entry", () => {
    expect((typeof indexExports as any).useContentSecurityPolicy).not.toBe(
      "function",
    )
  })

  it("should export schemas as objects", () => {
    expect(indexExports.CSPDirectivesSchema).toBeDefined()
    expect(indexExports.CSPDirectivesSchema.parse).toBeDefined()
    expect(indexExports.CSPModeSchema).toBeDefined()
    expect(indexExports.CSPModeSchema.parse).toBeDefined()
    expect(indexExports.HeartbeatConfigErrorSchema).toBeDefined()
    expect(indexExports.HeartbeatConfigErrorSchema.parse).toBeDefined()
    expect(indexExports.HeartbeatResponseBodySchema).toBeDefined()
    expect(indexExports.HeartbeatResponseBodySchema.parse).toBeDefined()
    expect(typeof indexExports.validateHeartbeatResponseBody).toBe("function")
  })

  it("should export utility functions", () => {
    expect(typeof indexExports.getEdgeConfigId).toBe("function")
    expect(typeof indexExports.isCacheUrl.edgeConfig).toBe("function")
    expect(typeof indexExports.isCacheUrl.upstash).toBe("function")
    expect(typeof indexExports.isValidCacheUrl.edgeConfig).toBe("function")
    expect(typeof indexExports.isValidCacheUrl.upstash).toBe("function")
  })
})

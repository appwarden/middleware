import { describe, expect, it } from "vitest"
import {
  APPWARDEN_CACHE_KEY,
  APPWARDEN_HEARTBEAT_ROUTE,
  HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES,
  HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_COUNT,
  HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
  HEARTBEAT_CONTRACT_VERSION,
  HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES,
  HEARTBEAT_SERVICES,
  HEARTBEAT_SERVICE_VALUES,
  HEARTBEAT_VERSION_MAX_LENGTH,
  LOCKDOWN_TEST_EXPIRY_MS,
} from "./constants"
import * as indexExports from "./index"

describe("index exports", () => {
  it("should export constants with correct values", () => {
    expect(indexExports.APPWARDEN_CACHE_KEY).toBe(APPWARDEN_CACHE_KEY)
    expect(indexExports.LOCKDOWN_TEST_EXPIRY_MS).toBe(LOCKDOWN_TEST_EXPIRY_MS)
  })

  it("should export heartbeat route constant", () => {
    expect(indexExports.APPWARDEN_HEARTBEAT_ROUTE).toBe(
      APPWARDEN_HEARTBEAT_ROUTE,
    )
  })

  it("should export heartbeat contract version constant", () => {
    expect(indexExports.HEARTBEAT_CONTRACT_VERSION).toBe(
      HEARTBEAT_CONTRACT_VERSION,
    )
  })

  it("should export heartbeat version max length constant", () => {
    expect(indexExports.HEARTBEAT_VERSION_MAX_LENGTH).toBe(
      HEARTBEAT_VERSION_MAX_LENGTH,
    )
  })

  it("should export heartbeat config error max count constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_COUNT).toBe(
      HEARTBEAT_CONFIG_ERROR_MAX_COUNT,
    )
  })

  it("should export heartbeat config error max path depth constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH).toBe(
      HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
    )
  })

  it("should export heartbeat config error max code length constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH).toBe(
      HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH,
    )
  })

  it("should export heartbeat config error max message length constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH).toBe(
      HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
    )
  })

  it("should export heartbeat config errors max serialized bytes constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES).toBe(
      HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES,
    )
  })

  it("should export heartbeat response body max serialized bytes constant", () => {
    expect(indexExports.HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES).toBe(
      HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES,
    )
  })

  it("should export heartbeat config error max path segment length constant", () => {
    expect(indexExports.HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH).toBe(
      HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
    )
  })

  it("should export heartbeat service values array", () => {
    expect(indexExports.HEARTBEAT_SERVICE_VALUES).toEqual(
      HEARTBEAT_SERVICE_VALUES,
    )
  })

  it("should export heartbeat services object", () => {
    expect(indexExports.HEARTBEAT_SERVICES).toEqual(HEARTBEAT_SERVICES)
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

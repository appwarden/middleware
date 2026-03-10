import { describe, expect, it } from "vitest"
import {
  HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
  HEARTBEAT_CONTRACT_VERSION,
  HEARTBEAT_SERVICE_VALUES,
} from "../constants"
import {
  HeartbeatConfigErrorSchema,
  HeartbeatResponseBodySchema,
} from "./heartbeat"

describe("heartbeat types", () => {
  describe("HeartbeatConfigErrorSchema", () => {
    it("should validate a valid config error", () => {
      const validError = {
        path: ["lockPageSlug"],
        code: "invalid_type",
        message: "Expected string, received number",
      }

      const result = HeartbeatConfigErrorSchema.safeParse(validError)
      expect(result.success).toBe(true)
    })

    it("should reject error with missing fields", () => {
      const invalidError = {
        path: ["lockPageSlug"],
        code: "invalid_type",
        // missing message
      }

      const result = HeartbeatConfigErrorSchema.safeParse(invalidError)
      expect(result.success).toBe(false)
    })

    it("should reject error with code longer than 100 chars", () => {
      const invalidError = {
        path: ["lockPageSlug"],
        code: "a".repeat(HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH + 1),
        message: "Error message",
      }

      const result = HeartbeatConfigErrorSchema.safeParse(invalidError)
      expect(result.success).toBe(false)
    })

    it("should reject error with message longer than 500 chars", () => {
      const invalidError = {
        path: ["lockPageSlug"],
        code: "invalid_type",
        message: "a".repeat(HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH + 1),
      }

      const result = HeartbeatConfigErrorSchema.safeParse(invalidError)
      expect(result.success).toBe(false)
    })

    it("should accept path with mixed string and number elements", () => {
      const validError = {
        path: ["config", 0, "lockPageSlug"],
        code: "invalid_type",
        message: "Error message",
      }

      const result = HeartbeatConfigErrorSchema.safeParse(validError)
      expect(result.success).toBe(true)
    })
  })

  describe("HeartbeatResponseBodySchema", () => {
    it("should validate a valid heartbeat response", () => {
      const validResponse = {
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "cloudflare",
        version: "1.0.0",
        configErrors: [],
      }

      const result = HeartbeatResponseBodySchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("should validate response with config errors", () => {
      const validResponse = {
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "cloudflare-astro",
        version: "1.0.0",
        configErrors: [
          {
            path: ["lockPageSlug"],
            code: "invalid_type",
            message: "Expected string",
          },
        ],
      }

      const result = HeartbeatResponseBodySchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("should reject response with wrong app value", () => {
      const invalidResponse = {
        app: "wrong",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "cloudflare",
        version: "1.0.0",
        configErrors: [],
      }

      const result = HeartbeatResponseBodySchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response with wrong kind value", () => {
      const invalidResponse = {
        app: "appwarden",
        kind: "wrong",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "cloudflare",
        version: "1.0.0",
        configErrors: [],
      }

      const result = HeartbeatResponseBodySchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response with wrong contract version", () => {
      const invalidResponse = {
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION + 1,
        service: "cloudflare",
        version: "1.0.0",
        configErrors: [],
      }

      const result = HeartbeatResponseBodySchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it("should reject response with invalid service", () => {
      const invalidResponse = {
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "invalid-service",
        version: "1.0.0",
        configErrors: [],
      }

      const result = HeartbeatResponseBodySchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it.each(HEARTBEAT_SERVICE_VALUES)(
      "should accept %s as a valid service type",
      (service) => {
        const validResponse = {
          app: "appwarden",
          kind: "heartbeat",
          status: "ok",
          contractVersion: HEARTBEAT_CONTRACT_VERSION,
          service,
          version: "1.0.0",
          configErrors: [],
        }

        const result = HeartbeatResponseBodySchema.safeParse(validResponse)
        expect(result.success).toBe(true)
      },
    )
  })
})

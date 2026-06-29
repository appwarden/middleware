import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import {
  HEARTBEAT_CONFIG_ERROR_MAX_COUNT,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
  HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES,
  HEARTBEAT_CONTRACT_VERSION,
} from "../constants"
import { HeartbeatResponseBodySchema } from "../types/heartbeat"
import {
  createHeartbeatConfigError,
  createHeartbeatResponse,
  createHeartbeatResponseBody,
  handleHeartbeatRequest,
  isHeartbeatRequest,
  sanitizeConfigErrors,
} from "./heartbeat"

const getSerializedJsonByteLength = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length

const getOversizedConfigErrors = () =>
  Array.from({ length: HEARTBEAT_CONFIG_ERROR_MAX_COUNT }, (_, index) => ({
    path: Array.from(
      { length: HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH },
      (_, segmentIndex) =>
        `${index}-${segmentIndex}`.padEnd(
          HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
          "p",
        ),
    ),
    code: `code-${index}`,
    message: "m".repeat(500),
  }))

describe("heartbeat utilities", () => {
  describe("sanitizeConfigErrors", () => {
    it("should return empty array when no error is provided", () => {
      const result = sanitizeConfigErrors(undefined)
      expect(result).toEqual([])
    })

    it("should sanitize Zod validation errors", () => {
      const error = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["lockPageSlug"],
          message: "Expected string, received number",
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["lockPageSlug"],
        code: "invalid_type",
        message: "Invalid type for lockPageSlug. Expected string",
      })
    })

    it("should limit errors to the contract max", () => {
      const issues = Array.from(
        { length: HEARTBEAT_CONFIG_ERROR_MAX_COUNT + 5 },
        (_, i) => ({
          code: "invalid_type" as const,
          expected: "string" as const,
          received: "number" as const,
          path: [`field${i}`],
          message: `Error ${i}`,
        }),
      )

      const error = new ZodError(issues)
      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(HEARTBEAT_CONFIG_ERROR_MAX_COUNT)
    })

    it("should ignore raw Zod messages and use controlled sanitization", () => {
      const longMessage = "a".repeat(600)
      const error = new ZodError([
        {
          code: "custom",
          path: ["test"],
          message: longMessage,
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result[0].message).toBe("Validation failed for test")
    })

    it("should return the Appwarden-controlled message for a keyed appwardenApiToken error", () => {
      const error = new ZodError([
        {
          code: "custom",
          path: ["appwardenApiToken"],
          message: "appwardenApiToken is required",
          params: {
            appwardenErrorKey: "APPWARDEN_API_TOKEN_MISSING",
          },
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["appwardenApiToken"],
        code: "custom",
        message:
          "APPWARDEN_API_TOKEN is missing or empty. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      })
    })

    it("should return the Appwarden-controlled message for a missing appwardenApiToken", () => {
      const error = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["appwardenApiToken"],
          message: "Required",
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["appwardenApiToken"],
        code: "invalid_type",
        message:
          "APPWARDEN_API_TOKEN is missing or empty. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      })
    })

    it("should not mask a non-missing type error for appwardenApiToken", () => {
      const error = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["appwardenApiToken"],
          message: "Expected string, received number",
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["appwardenApiToken"],
        code: "invalid_type",
        message: "Invalid type for appwardenApiToken. Expected string",
      })
    })

    it("should return the Appwarden-controlled message for a keyed nonce error", () => {
      const error = new ZodError([
        {
          code: "custom",
          path: ["contentSecurityPolicy", "directives"],
          message: "Nonce-based CSP is not supported",
          params: {
            appwardenErrorKey: "NEXTJS_NONCE_UNSUPPORTED",
          },
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["contentSecurityPolicy", "directives"],
        code: "custom",
        message:
          "Nonce-based CSP is not supported in the Next.js Cloudflare adapter. Remove '{{nonce}}' placeholders from your CSP directives, as this adapter does not inject nonces into HTML.",
      })
    })

    it("should provide descriptive error for invalid_union with type mismatch", () => {
      // Simulate the error when a number is passed to a union of string literals
      const error = new ZodError([
        {
          code: "invalid_union",
          unionErrors: [
            new ZodError([
              {
                code: "invalid_literal",
                expected: "disabled",
                received: 2,
                path: [],
                message: 'Invalid literal value, expected "disabled"',
              },
            ]),
            new ZodError([
              {
                code: "invalid_literal",
                expected: "report-only",
                received: 2,
                path: [],
                message: 'Invalid literal value, expected "report-only"',
              },
            ]),
            new ZodError([
              {
                code: "invalid_literal",
                expected: "enforced",
                received: 2,
                path: [],
                message: 'Invalid literal value, expected "enforced"',
              },
            ]),
          ],
          path: ["mode"],
          message: "Invalid input",
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["mode"],
        code: "invalid_union",
        message:
          "Invalid type for mode. Expected disabled | report-only | enforced",
      })
    })

    it("should handle invalid_return_type without expected type", () => {
      const error = new ZodError([
        {
          code: "invalid_return_type",
          path: ["config"],
          message: "Invalid return type",
          returnTypeError: new ZodError([]),
        } as any,
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["config"],
        code: "invalid_return_type",
        message: "Invalid return type for config",
      })
    })
  })

  describe("createHeartbeatConfigError", () => {
    it("should create a controlled heartbeat config error", () => {
      const result = createHeartbeatConfigError(
        ["runtime"],
        "custom",
        "Cloudflare runtime unavailable",
      )

      expect(result).toEqual({
        path: ["runtime"],
        code: "custom",
        message: "Cloudflare runtime unavailable",
      })
    })

    it("should never emit empty code or message", () => {
      const result = createHeartbeatConfigError(["runtime"], "   ", "   ")

      expect(result.code).toBe("custom")
      expect(result.message).toBe("Appwarden configuration validation failed")
      expect(
        HeartbeatResponseBodySchema.safeParse({
          app: "appwarden",
          kind: "heartbeat",
          status: "ok",
          contractVersion: HEARTBEAT_CONTRACT_VERSION,
          service: "cloudflare",
          version: "1.0.0",
          configErrors: [result],
        }).success,
      ).toBe(true)
    })
  })

  describe("createHeartbeatResponseBody", () => {
    it("should always return a schema-valid heartbeat response body", () => {
      const body = createHeartbeatResponseBody("cloudflare")

      expect(HeartbeatResponseBodySchema.safeParse(body).success).toBe(true)
      expect(body).toMatchObject({
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "cloudflare",
        configErrors: [],
      })
      expect(body.version).toBeDefined()
    })

    it("should normalize config errors within all schema limits", () => {
      const longSegment = "s".repeat(120)
      const configErrors = [
        {
          path: ["config", -5.9, longSegment, { nested: true }] as any,
          code: "   ",
          message: "   ",
        },
      ]

      const body = createHeartbeatResponseBody("cloudflare-astro", configErrors)

      expect(body.configErrors).toEqual([
        {
          path: ["config", 0, `${"s".repeat(97)}...`, "[object Object]"],
          code: "custom",
          message: "Appwarden configuration validation failed",
        },
      ])
      expect(HeartbeatResponseBodySchema.safeParse(body).success).toBe(true)
    })

    it("should trim config errors to stay within the serialized byte budget", () => {
      const oversizedConfigErrors = getOversizedConfigErrors()

      expect(
        getSerializedJsonByteLength(oversizedConfigErrors),
      ).toBeGreaterThan(HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES)

      const body = createHeartbeatResponseBody(
        "cloudflare-astro",
        oversizedConfigErrors,
      )

      expect(HeartbeatResponseBodySchema.safeParse(body).success).toBe(true)
      expect(
        getSerializedJsonByteLength(body.configErrors),
      ).toBeLessThanOrEqual(HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES)
    })
  })

  describe("createHeartbeatResponse", () => {
    it("should create a Response with correct headers", () => {
      const response = createHeartbeatResponse("cloudflare-nextjs")
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("application/json")
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("x-appwarden-heartbeat")).toBe("1")
      expect(response.headers.get("x-appwarden-contract-version")).toBe(
        String(HEARTBEAT_CONTRACT_VERSION),
      )
      expect(response.headers.get("x-appwarden-service")).toBe(
        "cloudflare-nextjs",
      )
      expect(response.headers.get("x-appwarden-version")).toBeDefined()
    })

    it("should include valid JSON body", async () => {
      const response = createHeartbeatResponse("vercel")
      const body = HeartbeatResponseBodySchema.parse(await response.json())

      expect(body).toMatchObject({
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: HEARTBEAT_CONTRACT_VERSION,
        service: "vercel",
      })
      expect(response.headers.get("x-appwarden-version")).toBe(body.version)
    })
  })

  describe("isHeartbeatRequest", () => {
    it("should return true for GET requests to the heartbeat route", () => {
      const request = new Request("https://example.com/_appwarden/heartbeat", {
        method: "GET",
      })
      const url = new URL(request.url)

      expect(isHeartbeatRequest(request, url)).toBe(true)
    })

    it("should return false for other routes", () => {
      const request = new Request("https://example.com/", {
        method: "GET",
      })
      const url = new URL(request.url)

      expect(isHeartbeatRequest(request, url)).toBe(false)
    })

    it("should return false for similar routes", () => {
      const request = new Request(
        "https://example.com/_appwarden/heartbeat/extra",
        {
          method: "GET",
        },
      )
      const url = new URL(request.url)

      expect(isHeartbeatRequest(request, url)).toBe(false)
    })

    it("should return false for non-GET requests to the heartbeat route", () => {
      const request = new Request("https://example.com/_appwarden/heartbeat", {
        method: "POST",
      })
      const url = new URL(request.url)

      expect(isHeartbeatRequest(request, url)).toBe(false)
    })
  })

  describe("handleHeartbeatRequest", () => {
    it("should return heartbeat response for GET requests", () => {
      const request = new Request("https://example.com/_appwarden/heartbeat", {
        method: "GET",
      })
      const response = handleHeartbeatRequest(request, "cloudflare", [])
      expect(response.status).toBe(200)
    })
  })
})

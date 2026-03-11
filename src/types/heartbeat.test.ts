import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import {
  HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_COUNT,
  HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
  HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES,
  HEARTBEAT_CONTRACT_VERSION,
  HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES,
  HEARTBEAT_SERVICE_VALUES,
  HEARTBEAT_VERSION_MAX_LENGTH,
} from "../constants"
import {
  HeartbeatConfigErrorSchema,
  HeartbeatResponseBodySchema,
  validateHeartbeatResponseBody,
} from "./heartbeat"

const getSerializedJsonByteLength = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length

const getValidConfigError = (overrides: Record<string, unknown> = {}) => ({
  path: ["config", 0, "lockPageSlug"],
  code: "invalid_type",
  message: "Invalid type for lockPageSlug",
  ...overrides,
})

const getValidResponse = (overrides: Record<string, unknown> = {}) => ({
  app: "appwarden",
  kind: "heartbeat",
  status: "ok",
  contractVersion: HEARTBEAT_CONTRACT_VERSION,
  service: "cloudflare",
  version: "1.0.0",
  configErrors: [],
  ...overrides,
})

const getOversizedConfigErrors = () =>
  Array.from({ length: HEARTBEAT_CONFIG_ERROR_MAX_COUNT }, (_, index) =>
    getValidConfigError({
      path: Array.from(
        { length: HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH },
        (_, segmentIndex) =>
          `${index}-${segmentIndex}`.padEnd(
            HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
            "p",
          ),
      ),
      code: "c".repeat(HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH),
      message: "m".repeat(HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH),
    }),
  )

describe("heartbeat types", () => {
  describe("HeartbeatConfigErrorSchema", () => {
    it("should validate a valid config error", () => {
      expect(
        HeartbeatConfigErrorSchema.safeParse(getValidConfigError()).success,
      ).toBe(true)
    })

    it.each([
      ["empty code", getValidConfigError({ code: "" })],
      ["empty message", getValidConfigError({ message: "" })],
      [
        "overlong code",
        getValidConfigError({
          code: "a".repeat(HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH + 1),
        }),
      ],
      [
        "overlong message",
        getValidConfigError({
          message: "a".repeat(HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH + 1),
        }),
      ],
      [
        "overly deep path",
        getValidConfigError({
          path: Array.from(
            { length: HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH + 1 },
            () => "segment",
          ),
        }),
      ],
      [
        "invalid path segment type",
        getValidConfigError({ path: ["config", true] }),
      ],
      [
        "unknown keys inside config error items",
        { ...getValidConfigError(), extra: true },
      ],
    ])("should reject %s", (_, invalidError) => {
      expect(HeartbeatConfigErrorSchema.safeParse(invalidError).success).toBe(
        false,
      )
    })
  })

  describe("HeartbeatResponseBodySchema", () => {
    it("should validate a valid heartbeat response", () => {
      expect(
        HeartbeatResponseBodySchema.safeParse(getValidResponse()).success,
      ).toBe(true)
    })

    it("should validate response with config errors", () => {
      expect(
        HeartbeatResponseBodySchema.safeParse(
          getValidResponse({
            service: "cloudflare-astro",
            configErrors: [getValidConfigError()],
          }),
        ).success,
      ).toBe(true)
    })

    it.each([
      ["wrong app value", getValidResponse({ app: "wrong" })],
      ["wrong kind value", getValidResponse({ kind: "wrong" })],
      [
        "wrong contract version",
        getValidResponse({ contractVersion: HEARTBEAT_CONTRACT_VERSION + 1 }),
      ],
      ["invalid service", getValidResponse({ service: "invalid-service" })],
      ["empty version", getValidResponse({ version: "" })],
      [
        "overlong version",
        getValidResponse({
          version: "v".repeat(HEARTBEAT_VERSION_MAX_LENGTH + 1),
        }),
      ],
      [
        "too many config errors",
        getValidResponse({
          configErrors: Array.from(
            { length: HEARTBEAT_CONFIG_ERROR_MAX_COUNT + 1 },
            () => getValidConfigError(),
          ),
        }),
      ],
      ["unknown top-level body keys", { ...getValidResponse(), extra: true }],
    ])("should reject %s", (_, invalidResponse) => {
      expect(
        HeartbeatResponseBodySchema.safeParse(invalidResponse).success,
      ).toBe(false)
    })

    it.each(HEARTBEAT_SERVICE_VALUES)(
      "should accept %s as a valid service type",
      (service) => {
        expect(
          HeartbeatResponseBodySchema.safeParse(getValidResponse({ service }))
            .success,
        ).toBe(true)
      },
    )

    it("should reject configErrors payloads that exceed the byte budget", () => {
      const oversizedConfigErrors = getOversizedConfigErrors()

      expect(
        getSerializedJsonByteLength(oversizedConfigErrors),
      ).toBeGreaterThan(HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES)

      const result = HeartbeatResponseBodySchema.safeParse(
        getValidResponse({ configErrors: oversizedConfigErrors }),
      )

      expect(result.success).toBe(false)

      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes(
              String(HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES),
            ),
          ),
        ).toBe(true)
      }
    })

    it("should reject full response bodies that exceed the byte budget", () => {
      const oversizedResponse = {
        ...getValidResponse(),
        overflow: "x".repeat(HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES),
      }

      expect(getSerializedJsonByteLength(oversizedResponse)).toBeGreaterThan(
        HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES,
      )

      expect(() =>
        validateHeartbeatResponseBody(oversizedResponse),
      ).toThrowError(String(HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES))
    })

    it.each([
      ["BigInt values", () => ({ ...getValidResponse(), version: 1n })],
      [
        "circular objects",
        () => {
          const circularResponse: Record<string, unknown> = getValidResponse()
          circularResponse.self = circularResponse
          return circularResponse
        },
      ],
    ])(
      "should reject non-JSON-serializable input with a structured validation error for %s",
      (_, createValue) => {
        let thrownError: unknown

        try {
          validateHeartbeatResponseBody(createValue())
        } catch (error) {
          thrownError = error
        }

        expect(thrownError).toBeInstanceOf(ZodError)

        if (thrownError instanceof ZodError) {
          expect(thrownError.issues[0]?.message).toContain("JSON-serializable")
        }
      },
    )
  })
})

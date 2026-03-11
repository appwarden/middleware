import { z } from "zod"
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

/**
 * Service identifiers for different middleware adapters.
 * These are hardcoded per adapter bundle.
 */
export type HeartbeatService = (typeof HEARTBEAT_SERVICE_VALUES)[number]

/**
 * Sanitized configuration error for public heartbeat response.
 * This is a stable subset of ZodIssue to avoid exposing sensitive data.
 */
function getSerializedJsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function getHeartbeatResponseBodyByteBudgetIssue(): z.ZodIssue {
  return {
    code: z.ZodIssueCode.custom,
    message: `Serialized heartbeat response body must be at most ${HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES} bytes`,
    path: [],
  }
}

function getHeartbeatResponseBodySerializationIssue(): z.ZodIssue {
  return {
    code: z.ZodIssueCode.custom,
    message: "Heartbeat response body must be JSON-serializable",
    path: [],
  }
}

/**
 * Heartbeat response body contract.
 * This is the JSON body returned by the /_appwarden/heartbeat endpoint.
 */
const HeartbeatConfigErrorPathSegmentSchema = z.union([
  z.string().max(HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH),
  z.number().int().nonnegative(),
])

/**
 * Schema for validating heartbeat config errors.
 * Ensures errors are bounded and sanitized.
 */
export const HeartbeatConfigErrorSchema = z
  .object({
    path: z
      .array(HeartbeatConfigErrorPathSegmentSchema)
      .max(HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH),
    code: z.string().min(1).max(HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH),
    message: z.string().min(1).max(HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH),
  })
  .strict()

export type HeartbeatConfigError = z.infer<typeof HeartbeatConfigErrorSchema>

const HeartbeatConfigErrorsSchema = z
  .array(HeartbeatConfigErrorSchema)
  .max(HEARTBEAT_CONFIG_ERROR_MAX_COUNT)
  .superRefine((configErrors, ctx) => {
    if (
      getSerializedJsonByteLength(configErrors) >
      HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Serialized configErrors payload must be at most ${HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES} bytes`,
      })
    }
  })

/**
 * Schema for validating the heartbeat response body.
 */
export const HeartbeatResponseBodySchema = z
  .object({
    app: z.literal("appwarden"),
    kind: z.literal("heartbeat"),
    status: z.literal("ok"),
    contractVersion: z.literal(HEARTBEAT_CONTRACT_VERSION),
    service: z.enum(HEARTBEAT_SERVICE_VALUES),
    version: z.string().min(1).max(HEARTBEAT_VERSION_MAX_LENGTH),
    configErrors: HeartbeatConfigErrorsSchema,
  })
  .strict()
  .superRefine((body, ctx) => {
    if (
      getSerializedJsonByteLength(body) >
      HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Serialized heartbeat response body must be at most ${HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES} bytes`,
      })
    }
  })

export type HeartbeatResponseBody = z.infer<typeof HeartbeatResponseBodySchema>

export function validateHeartbeatResponseBody(
  value: unknown,
): HeartbeatResponseBody {
  let serializedJsonByteLength: number

  try {
    serializedJsonByteLength = getSerializedJsonByteLength(value)
  } catch {
    throw new z.ZodError([getHeartbeatResponseBodySerializationIssue()])
  }

  if (serializedJsonByteLength > HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES) {
    throw new z.ZodError([getHeartbeatResponseBodyByteBudgetIssue()])
  }

  return HeartbeatResponseBodySchema.parse(value)
}

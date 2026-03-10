import { z } from "zod"
import {
  HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_COUNT,
  HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
  HEARTBEAT_CONTRACT_VERSION,
  HEARTBEAT_SERVICE_VALUES,
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
export interface HeartbeatConfigError {
  /** Path to the config field that has an error */
  path: (string | number)[]
  /** Error code (e.g., "invalid_type", "too_small") */
  code: string
  /** Human-readable error message */
  message: string
}

/**
 * Heartbeat response body contract.
 * This is the JSON body returned by the /_appwarden/heartbeat endpoint.
 */
export interface HeartbeatResponseBody {
  /** Always "appwarden" */
  app: "appwarden"
  /** Always "heartbeat" */
  kind: "heartbeat"
  /** Always "ok" for successful responses */
  status: "ok"
  /** Contract version (currently 1) */
  contractVersion: typeof HEARTBEAT_CONTRACT_VERSION
  /** Service identifier (e.g., "cloudflare-astro") */
  service: HeartbeatService
  /** Installed middleware package version */
  version: string
  /** Configuration errors, if any */
  configErrors: HeartbeatConfigError[]
}

/**
 * Schema for validating heartbeat config errors.
 * Ensures errors are bounded and sanitized.
 */
export const HeartbeatConfigErrorSchema = z.object({
  path: z
    .array(
      z.union([
        z.string().max(HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH),
        z.number().int().nonnegative(),
      ]),
    )
    .max(HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH),
  code: z.string().max(HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH),
  message: z.string().max(HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH),
})

/**
 * Schema for validating the heartbeat response body.
 */
export const HeartbeatResponseBodySchema = z.object({
  app: z.literal("appwarden"),
  kind: z.literal("heartbeat"),
  status: z.literal("ok"),
  contractVersion: z.literal(HEARTBEAT_CONTRACT_VERSION),
  service: z.enum(HEARTBEAT_SERVICE_VALUES),
  version: z.string(),
  configErrors: z
    .array(HeartbeatConfigErrorSchema)
    .max(HEARTBEAT_CONFIG_ERROR_MAX_COUNT),
})

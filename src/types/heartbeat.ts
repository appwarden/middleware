import { z } from "zod"

/**
 * Service identifiers for different middleware adapters.
 * These are hardcoded per adapter bundle.
 */
export type HeartbeatService =
  | "cloudflare"
  | "cloudflare-astro"
  | "cloudflare-react-router"
  | "cloudflare-tanstack-start"
  | "cloudflare-nextjs"
  | "vercel"

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
  contractVersion: 1
  /** Service identifier (e.g., "cloudflare-astro") */
  service: HeartbeatService
  /** Installed middleware package version */
  version: string
  /** Configuration errors, if any */
  configErrors: HeartbeatConfigError[]
}

/**
 * Maximum path depth for config errors.
 * Prevents deeply nested paths from being exposed.
 */
const MAX_PATH_DEPTH = 10

/**
 * Maximum length for path segments.
 * Prevents excessively long path segments.
 */
const MAX_PATH_SEGMENT_LENGTH = 100

/**
 * Schema for validating heartbeat config errors.
 * Ensures errors are bounded and sanitized.
 */
export const HeartbeatConfigErrorSchema = z.object({
  path: z
    .array(
      z.union([
        z.string().max(MAX_PATH_SEGMENT_LENGTH),
        z.number().int().nonnegative(),
      ]),
    )
    .max(MAX_PATH_DEPTH),
  code: z.string().max(100),
  message: z.string().max(500),
})

/**
 * Schema for validating the heartbeat response body.
 */
export const HeartbeatResponseBodySchema = z.object({
  app: z.literal("appwarden"),
  kind: z.literal("heartbeat"),
  status: z.literal("ok"),
  contractVersion: z.literal(1),
  service: z.enum([
    "cloudflare",
    "cloudflare-astro",
    "cloudflare-react-router",
    "cloudflare-tanstack-start",
    "cloudflare-nextjs",
    "vercel",
  ]),
  version: z.string(),
  configErrors: z.array(HeartbeatConfigErrorSchema).max(10),
})

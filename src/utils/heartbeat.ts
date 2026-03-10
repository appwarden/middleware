import { ZodError } from "zod"
import {
  APPWARDEN_HEARTBEAT_ROUTE,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
} from "../constants"
import type {
  HeartbeatConfigError,
  HeartbeatResponseBody,
  HeartbeatService,
} from "../types/heartbeat"
import { MIDDLEWARE_VERSION } from "../version"

/**
 * Maximum number of config errors to include in heartbeat response.
 * This prevents unbounded response sizes.
 */
const MAX_CONFIG_ERRORS = 10

/**
 * Maximum length for error messages.
 * Prevents excessively long messages from being exposed.
 */
const MAX_MESSAGE_LENGTH = 500

/**
 * Maximum length for error codes.
 * Keeps error codes within the public contract bounds.
 */
const MAX_CODE_LENGTH = 100

/**
 * Creates a sanitized error message based on the Zod error code.
 * This ensures only Appwarden-controlled messages are exposed, not user-provided values.
 *
 * @param code - The Zod error code
 * @param path - The path to the field with the error
 * @returns A sanitized error message
 */
function createSanitizedMessage(
  code: string,
  path: (string | number)[],
): string {
  const fieldName = path.length > 0 ? path[path.length - 1] : "field"

  // Map Zod error codes to controlled messages
  switch (code) {
    case "invalid_type":
      return `Invalid type for ${fieldName}`
    case "invalid_literal":
      return `Invalid value for ${fieldName}`
    case "unrecognized_keys":
      return `Unrecognized keys in ${fieldName}`
    case "invalid_union":
      return `Invalid union value for ${fieldName}`
    case "invalid_enum_value":
      return `Invalid enum value for ${fieldName}`
    case "invalid_arguments":
      return `Invalid arguments for ${fieldName}`
    case "invalid_return_type":
      return `Invalid return type for ${fieldName}`
    case "invalid_date":
      return `Invalid date for ${fieldName}`
    case "invalid_string":
      return `Invalid string format for ${fieldName}`
    case "too_small":
      return `Value too small for ${fieldName}`
    case "too_big":
      return `Value too large for ${fieldName}`
    case "invalid_intersection_types":
      return `Invalid intersection types for ${fieldName}`
    case "not_multiple_of":
      return `Value not a multiple of required value for ${fieldName}`
    case "not_finite":
      return `Value must be finite for ${fieldName}`
    case "custom":
      return `Validation failed for ${fieldName}`
    default:
      return `Validation error for ${fieldName}`
  }
}

/**
 * Sanitizes a path array to prevent exposure of sensitive data.
 * Truncates path depth and segment lengths.
 *
 * @param path - The path array to sanitize
 * @returns Sanitized path array
 */
function sanitizePath(path: (string | number)[]): (string | number)[] {
  // Limit path depth
  const truncatedPath = path.slice(0, HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH)

  // Limit segment lengths
  return truncatedPath.map((segment) => {
    if (
      typeof segment === "string" &&
      segment.length > HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH
    ) {
      return (
        segment.substring(
          0,
          HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH - 3,
        ) + "..."
      )
    }
    return segment
  })
}

function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message
  }

  return message.substring(0, MAX_MESSAGE_LENGTH - 3) + "..."
}

/**
 * Creates a controlled heartbeat config error.
 * Useful for internal runtime/context failures that are not sourced from Zod.
 *
 * @param path - The logical field path for the failure
 * @param code - A bounded error code
 * @param message - An Appwarden-controlled error message
 * @returns A sanitized heartbeat config error
 */
export function createHeartbeatConfigError(
  path: (string | number)[],
  code: string,
  message: string,
): HeartbeatConfigError {
  return {
    path: sanitizePath(path),
    code: code.substring(0, MAX_CODE_LENGTH),
    message: truncateMessage(message),
  }
}

function normalizeHeartbeatConfigErrors(
  configErrors: HeartbeatConfigError[],
): HeartbeatConfigError[] {
  return configErrors
    .slice(0, MAX_CONFIG_ERRORS)
    .map((configError) =>
      createHeartbeatConfigError(
        configError.path,
        configError.code,
        configError.message,
      ),
    )
}

/**
 * Sanitizes Zod validation errors for public heartbeat response.
 * Maps errors to controlled messages and removes sensitive data.
 *
 * @param error - The Zod validation error
 * @returns Array of sanitized config errors
 */
export function sanitizeConfigErrors(
  error: ZodError | undefined,
): HeartbeatConfigError[] {
  if (!error) {
    return []
  }

  const errors: HeartbeatConfigError[] = []

  // Take only the first MAX_CONFIG_ERRORS issues
  const issues = error.issues.slice(0, MAX_CONFIG_ERRORS)

  for (const issue of issues) {
    // Sanitize the path to prevent exposure of deeply nested or long paths
    const sanitizedPath = sanitizePath(issue.path)

    // Create a controlled message based on the error code
    // This prevents exposure of user-provided values in error messages
    const message = truncateMessage(
      createSanitizedMessage(issue.code, sanitizedPath),
    )

    errors.push({
      path: sanitizedPath,
      code: issue.code,
      message,
    })
  }

  return errors
}

/**
 * Creates a heartbeat response body.
 *
 * @param service - The service identifier for this adapter
 * @param configErrors - Optional config validation errors
 * @returns The heartbeat response body
 */
export function createHeartbeatResponseBody(
  service: HeartbeatService,
  configErrors: HeartbeatConfigError[] = [],
): HeartbeatResponseBody {
  return {
    app: "appwarden",
    kind: "heartbeat",
    status: "ok",
    contractVersion: 1,
    service,
    version: MIDDLEWARE_VERSION,
    configErrors: normalizeHeartbeatConfigErrors(configErrors),
  }
}

/**
 * Creates a complete heartbeat Response object with proper headers.
 *
 * @param service - The service identifier for this adapter
 * @param configErrors - Optional config validation errors
 * @returns A Response object with the heartbeat contract
 */
export function createHeartbeatResponse(
  service: HeartbeatService,
  configErrors: HeartbeatConfigError[] = [],
): Response {
  const body = createHeartbeatResponseBody(service, configErrors)

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-appwarden-heartbeat": "1",
      "x-appwarden-contract-version": "1",
      "x-appwarden-service": service,
      "x-appwarden-version": MIDDLEWARE_VERSION,
    },
  })
}

/**
 * Checks if a request is for the heartbeat endpoint.
 *
 * @param url - The request URL
 * @returns True if the request is for the heartbeat endpoint
 */
export function isHeartbeatRequest(url: URL): boolean {
  return url.pathname === APPWARDEN_HEARTBEAT_ROUTE
}

/**
 * Handles a heartbeat request.
 * Returns a 405 Method Not Allowed for non-GET requests.
 *
 * @param request - The incoming request
 * @param service - The service identifier for this adapter
 * @param configErrors - Optional config validation errors
 * @returns A Response object
 */
export function handleHeartbeatRequest(
  request: Request,
  service: HeartbeatService,
  configErrors: HeartbeatConfigError[] = [],
): Response {
  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "GET",
      },
    })
  }

  return createHeartbeatResponse(service, configErrors)
}

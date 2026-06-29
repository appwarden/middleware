import { ZodError, ZodIssue } from "zod"
import {
  APPWARDEN_HEARTBEAT_ROUTE,
  HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_COUNT,
  HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH,
  HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
  HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES,
  HEARTBEAT_CONTRACT_VERSION,
  HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES,
} from "../constants"
import type {
  HeartbeatConfigError,
  HeartbeatResponseBody,
  HeartbeatService,
} from "../types/heartbeat"
import { validateHeartbeatResponseBody } from "../types/heartbeat"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"
import { MIDDLEWARE_VERSION } from "../version"

const DEFAULT_HEARTBEAT_CONFIG_ERROR_CODE = "custom"
const DEFAULT_HEARTBEAT_CONFIG_ERROR_MESSAGE =
  "Appwarden configuration validation failed"
const HEARTBEAT_CONSTRUCTION_FAILURE_BODY = JSON.stringify({
  error: "appwarden_heartbeat_construction_failed",
})

/**
 * Gets the expected type from a Zod issue.
 * For union errors, extracts all literal values and formats them as "value1 | value2 | value3".
 *
 * @param issue - The Zod issue
 * @returns The expected type as a string, or undefined if not available
 */
function getExpectedType(issue: ZodIssue): string | undefined {
  // For invalid_type errors, use the expected field
  if ("expected" in issue && typeof issue.expected === "string") {
    return issue.expected
  }

  // For invalid_union errors, extract all literal values from union errors
  if (
    issue.code === "invalid_union" &&
    "unionErrors" in issue &&
    Array.isArray(issue.unionErrors) &&
    issue.unionErrors.length > 0
  ) {
    // Try to extract all literal values from the union
    const literalValues: string[] = []
    let allAreLiterals = true

    for (const unionError of issue.unionErrors) {
      if (
        unionError &&
        "issues" in unionError &&
        Array.isArray(unionError.issues) &&
        unionError.issues.length > 0
      ) {
        const firstIssue = unionError.issues[0]
        if (firstIssue.code === "invalid_literal" && "expected" in firstIssue) {
          literalValues.push(String(firstIssue.expected))
        } else {
          allAreLiterals = false
          break
        }
      }
    }

    // If all union members are literals, return them formatted
    if (allAreLiterals && literalValues.length > 0) {
      return literalValues.join(" | ")
    }

    // Otherwise, derive expected types from union member issues when available
    const expectedTypes = new Set<string>()

    for (const unionError of issue.unionErrors) {
      if (
        unionError &&
        "issues" in unionError &&
        Array.isArray(unionError.issues) &&
        unionError.issues.length > 0
      ) {
        const firstIssue = unionError.issues[0] as any

        if (typeof firstIssue.expected === "string") {
          expectedTypes.add(firstIssue.expected)
        }
      }
    }

    if (expectedTypes.size > 0) {
      return Array.from(expectedTypes).join(" | ")
    }
  }

  return undefined
}

type AppwardenIssueParams = {
  appwardenErrorKey?: string
}

function getIssueParams(issue: ZodIssue): AppwardenIssueParams | undefined {
  if (issue.code !== "custom") {
    return undefined
  }
  return (issue as unknown as { params?: AppwardenIssueParams }).params
}

/**
 * Returns an Appwarden-controlled message for known schema-level errors.
 * Uses an explicit error key when available, otherwise falls back to the field path.
 */
function getAppwardenControlledMessage(
  issue: ZodIssue,
  path: (string | number)[],
): string | undefined {
  const key = getIssueParams(issue)?.appwardenErrorKey
  if (
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(AppwardenConfigErrorMessages, key)
  ) {
    return AppwardenConfigErrorMessages[key as AppwardenConfigErrorKey]
  }

  const lastSegment = path.length > 0 ? path[path.length - 1] : undefined
  if (
    lastSegment === "appwardenApiToken" &&
    issue.code === "invalid_type" &&
    ((issue as any).received === "undefined" ||
      (issue as any).received === "null")
  ) {
    return AppwardenConfigErrorMessages[
      AppwardenConfigErrorKey.AppwardenApiTokenMissing
    ]
  }

  return undefined
}

/**
 * Creates a sanitized error message based on the Zod error code.
 * This ensures only Appwarden-controlled messages are exposed, not user-provided values.
 *
 * @param issue - The Zod issue
 * @param path - The path to the field with the error
 * @returns A sanitized error message
 */
function createSanitizedMessage(
  issue: ZodIssue,
  path: (string | number)[],
): string {
  const controlledMessage = getAppwardenControlledMessage(issue, path)
  if (controlledMessage) {
    return controlledMessage
  }

  const fieldName = path.length > 0 ? path[path.length - 1] : "field"
  const code = issue.code

  // Map Zod error codes to controlled messages
  switch (code) {
    case "invalid_type": {
      const expectedType = getExpectedType(issue)
      return expectedType
        ? `Invalid type for ${fieldName}. Expected ${expectedType}`
        : `Invalid type for ${fieldName}`
    }
    case "invalid_literal":
      return `Invalid value for ${fieldName}`
    case "unrecognized_keys":
      return `Unrecognized keys in ${fieldName}`
    case "invalid_union": {
      const expectedType = getExpectedType(issue)
      return expectedType
        ? `Invalid type for ${fieldName}. Expected ${expectedType}`
        : `Invalid union value for ${fieldName}`
    }
    case "invalid_enum_value":
      return `Invalid enum value for ${fieldName}`
    case "invalid_arguments":
      return `Invalid arguments for ${fieldName}`
    case "invalid_return_type": {
      const expectedType = getExpectedType(issue)
      return expectedType
        ? `Invalid return type for ${fieldName}. Expected ${expectedType}`
        : `Invalid return type for ${fieldName}`
    }
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
function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  if (maxLength <= 3) {
    return value.substring(0, maxLength)
  }

  return value.substring(0, maxLength - 3) + "..."
}

function sanitizePathSegment(segment: unknown): string | number {
  if (typeof segment === "number" && Number.isFinite(segment)) {
    return Number.isSafeInteger(segment)
      ? Math.max(0, segment)
      : Math.max(0, Math.trunc(segment))
  }

  return truncateWithEllipsis(
    typeof segment === "string" ? segment : String(segment),
    HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH,
  )
}

function sanitizePath(path: readonly unknown[]): (string | number)[] {
  // Limit path depth
  const truncatedPath = path.slice(0, HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH)

  // Limit segment lengths
  return truncatedPath.map(sanitizePathSegment)
}

function truncateMessage(message: string): string {
  return truncateWithEllipsis(
    message,
    HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH,
  )
}

function truncateCode(code: string): string {
  return truncateWithEllipsis(code, HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH)
}

function normalizeNonEmptyString(
  value: string,
  fallback: string,
  truncate: (value: string) => string,
): string {
  const normalizedValue = truncate(value.trim())

  if (normalizedValue.length > 0) {
    return normalizedValue
  }

  return truncate(fallback)
}

function getSerializedJsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function isConfigErrorsWithinByteBudget(
  configErrors: HeartbeatConfigError[],
): boolean {
  return (
    getSerializedJsonByteLength(configErrors) <=
    HEARTBEAT_CONFIG_ERRORS_MAX_SERIALIZED_BYTES
  )
}

function isResponseBodyWithinByteBudget(body: HeartbeatResponseBody): boolean {
  return (
    getSerializedJsonByteLength(body) <=
    HEARTBEAT_RESPONSE_BODY_MAX_SERIALIZED_BYTES
  )
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
    code: normalizeNonEmptyString(
      code,
      DEFAULT_HEARTBEAT_CONFIG_ERROR_CODE,
      truncateCode,
    ),
    message: normalizeNonEmptyString(
      message,
      DEFAULT_HEARTBEAT_CONFIG_ERROR_MESSAGE,
      truncateMessage,
    ),
  }
}

function normalizeHeartbeatConfigErrors(
  configErrors: HeartbeatConfigError[],
): HeartbeatConfigError[] {
  const normalizedConfigErrors = configErrors
    .slice(0, HEARTBEAT_CONFIG_ERROR_MAX_COUNT)
    .map((configError) =>
      createHeartbeatConfigError(
        configError.path,
        configError.code,
        configError.message,
      ),
    )

  while (
    normalizedConfigErrors.length > 0 &&
    !isConfigErrorsWithinByteBudget(normalizedConfigErrors)
  ) {
    normalizedConfigErrors.pop()
  }

  return normalizedConfigErrors
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

  // Take only the first HEARTBEAT_CONFIG_ERROR_MAX_COUNT issues
  const issues = error.issues.slice(0, HEARTBEAT_CONFIG_ERROR_MAX_COUNT)

  for (const issue of issues) {
    // Sanitize the path to prevent exposure of deeply nested or long paths
    const sanitizedPath = sanitizePath(issue.path)

    // Create a controlled message based on the error code
    // This prevents exposure of user-provided values in error messages
    const message = truncateMessage(
      createSanitizedMessage(issue, sanitizedPath),
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
  const normalizedConfigErrors = normalizeHeartbeatConfigErrors(configErrors)
  const body: HeartbeatResponseBody = {
    app: "appwarden",
    kind: "heartbeat",
    status: "ok",
    contractVersion: HEARTBEAT_CONTRACT_VERSION,
    service,
    version: MIDDLEWARE_VERSION,
    configErrors: normalizedConfigErrors,
  }

  while (
    body.configErrors.length > 0 &&
    !isResponseBodyWithinByteBudget(body)
  ) {
    body.configErrors.pop()
  }

  return validateHeartbeatResponseBody(body)
}

function createHeartbeatConstructionFailureResponse(): Response {
  return new Response(HEARTBEAT_CONSTRUCTION_FAILURE_BODY, {
    status: 500,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  })
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
  try {
    const body = createHeartbeatResponseBody(service, configErrors)

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-appwarden-heartbeat": "1",
        "x-appwarden-contract-version": String(HEARTBEAT_CONTRACT_VERSION),
        "x-appwarden-service": service,
        "x-appwarden-version": MIDDLEWARE_VERSION,
      },
    })
  } catch {
    return createHeartbeatConstructionFailureResponse()
  }
}

/**
 * Checks if a URL targets the heartbeat endpoint.
 *
 * @param url - The request URL
 * @returns True if the URL pathname is the heartbeat route
 */
function isHeartbeatRoute(url: URL): boolean {
  return url.pathname === APPWARDEN_HEARTBEAT_ROUTE
}

/**
 * Checks if a request is for the heartbeat endpoint.
 *
 * Only GET requests should be treated as heartbeat requests.
 *
 * @param request - The incoming request
 * @param url - The request URL
 * @returns True if the request is for the heartbeat endpoint
 */
export function isHeartbeatRequest(request: Request, url: URL): boolean {
  return request.method === "GET" && isHeartbeatRoute(url)
}

/**
 * Handles a heartbeat request.
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
  return createHeartbeatResponse(service, configErrors)
}

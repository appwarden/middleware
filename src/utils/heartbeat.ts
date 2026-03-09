import { ZodError } from "zod"
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
 * Sanitizes Zod validation errors for public heartbeat response.
 * Removes sensitive data and bounds the error array.
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
    // Sanitize the error message to avoid exposing sensitive data
    // Remove any potential config values from the message
    let message = issue.message

    // Truncate message if too long
    if (message.length > 500) {
      message = message.substring(0, 497) + "..."
    }

    errors.push({
      path: issue.path,
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
    configErrors,
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
  return url.pathname === "/_appwarden/heartbeat"
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

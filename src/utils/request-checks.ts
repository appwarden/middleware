import { APPWARDEN_USER_AGENT } from "../constants"

/**
 * Check if a response has an HTML Content-Type header.
 * This checks the response's Content-Type header for "text/html".
 *
 * @param response - The Response object to check
 * @returns true if the Content-Type header includes "text/html"
 */
export function isHTMLResponse(response: Response): boolean {
  return response.headers.get("Content-Type")?.includes("text/html") ?? false
}

/**
 * Check if a request accepts HTML content.
 * This checks the request's Accept header for "text/html".
 *
 * @param request - The Request object to check
 * @returns true if the Accept header includes "text/html"
 */
export function isHTMLRequest(request: Request): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false
}

/**
 * Check if a request is from Appwarden's monitoring system.
 * This checks if the User-Agent header matches the APPWARDEN_USER_AGENT constant.
 *
 * @param request - The Request object to check
 * @returns true if the User-Agent header matches APPWARDEN_USER_AGENT
 */
export function isMonitoringRequest(request: Request): boolean {
  return request.headers.get("User-Agent") === APPWARDEN_USER_AGENT
}

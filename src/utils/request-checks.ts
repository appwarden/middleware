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
 * This function is intentionally strict to avoid false positives:
 * - Returns false for requests with no Accept header
 * - Returns false for wildcard-only Accept headers to avoid treating
 *   static assets (favicon.ico, images, etc.) as HTML requests
 * - Only returns true when "text/html" is explicitly listed
 *
 * @param request - The Request object to check
 * @returns true if the Accept header explicitly includes "text/html"
 */
export function isHTMLRequest(request: Request): boolean {
  const accept = request.headers.get("accept")

  // No Accept header = not an HTML request
  if (!accept) {
    return false
  }

  // Wildcard-only Accept header = not an HTML request
  // This prevents favicon.ico and other static assets from being treated as HTML
  if (accept === "*/*") {
    return false
  }

  // Check if text/html is explicitly listed in the Accept header
  return accept.includes("text/html")
}

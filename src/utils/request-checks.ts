/**
 * Normalize an HTTP method to uppercase for consistent comparison.
 * HTTP methods are case-sensitive per RFC 7231, but in practice they should
 * be compared case-insensitively for robustness.
 *
 * @param method - The HTTP method string to normalize
 * @returns The method in uppercase (e.g., "GET", "POST", "HEAD")
 *
 * @example
 * ```typescript
 * normalizeMethod("get")     // Returns: "GET"
 * normalizeMethod("POST")    // Returns: "POST"
 * normalizeMethod("Head")    // Returns: "HEAD"
 * ```
 */
export function normalizeMethod(method: string): string {
  return method.trim().toUpperCase()
}

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

  // Normalize to lowercase for case-insensitive comparison
  // Per HTTP semantics, media types are case-insensitive
  const normalizedAccept = accept.toLowerCase()

  // Determine if the Accept header is "wildcard-only", i.e. it only
  // contains */* (optionally with parameters or repeated entries).
  const isWildcardOnlyAccept = (value: string): boolean => {
    const mediaRanges = value.split(",")
    let hasNonEmptyRange = false

    for (const range of mediaRanges) {
      // Ignore any parameters (e.g. ;q=0.8) and trim whitespace
      const [typeSubtype] = range.split(";")
      const trimmed = typeSubtype.trim()

      if (!trimmed) {
        continue
      }

      hasNonEmptyRange = true

      // Only treat as wildcard if every non-empty range is */* or *
      if (trimmed !== "*/*" && trimmed !== "*") {
        return false
      }
    }

    return hasNonEmptyRange
  }

  // Wildcard-only Accept header = not an HTML request
  // This prevents favicon.ico and other static assets from being treated as HTML
  if (isWildcardOnlyAccept(normalizedAccept)) {
    return false
  }

  // Check if text/html is explicitly listed in the Accept header by
  // parsing media ranges and matching the type/subtype token exactly.
  const mediaRanges = normalizedAccept.split(",")
  for (const range of mediaRanges) {
    const [typeSubtype] = range.split(";")
    const token = typeSubtype.trim()
    if (token === "text/html") {
      return true
    }
  }

  return false
}

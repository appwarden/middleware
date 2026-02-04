/**
 * HTTP 302 Found - Temporary redirect status code.
 * Used to redirect users to the lock page when the site is locked.
 */
export const TEMPORARY_REDIRECT_STATUS = 302

/**
 * Creates a redirect response with the specified URL.
 *
 * This is a minimal, framework-agnostic implementation that creates a standard
 * Response object with a 302 status and Location header. It can be used across
 * different frameworks (React Router, TanStack Start, Astro, etc.) without
 * requiring framework-specific dependencies.
 *
 * @param url - The URL to redirect to
 * @returns A Response object configured for a temporary redirect
 *
 * @example
 * ```typescript
 * const lockPageUrl = new URL("/maintenance", request.url)
 * throw createRedirect(lockPageUrl)
 * ```
 */
export const createRedirect = (url: URL): Response => {
  return new Response(null, {
    status: TEMPORARY_REDIRECT_STATUS,
    headers: {
      Location: url.toString(),
    },
  })
}

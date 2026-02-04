/**
 * Normalizes a lock page slug and builds the full URL for the lock page.
 *
 * @param lockPageSlug - The slug/path of the lock page (e.g., "locked" or "/locked")
 * @param requestUrl - The current request URL to use as the base
 * @returns The full URL to the lock page
 *
 * @example
 * ```typescript
 * const url = buildLockPageUrl("locked", "https://example.com/dashboard")
 * // Returns: URL { href: "https://example.com/locked" }
 *
 * const url = buildLockPageUrl("/maintenance", "https://example.com/api/users")
 * // Returns: URL { href: "https://example.com/maintenance" }
 * ```
 */
export function buildLockPageUrl(
  lockPageSlug: string,
  requestUrl: string | URL,
): URL {
  // Normalize the lock page slug to ensure it starts with /
  const normalizedSlug = lockPageSlug.startsWith("/")
    ? lockPageSlug
    : `/${lockPageSlug}`

  return new URL(normalizedSlug, requestUrl)
}

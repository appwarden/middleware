/**
 * Normalizes a lock page slug to ensure it starts with a forward slash.
 *
 * @param lockPageSlug - The slug/path of the lock page (e.g., "locked" or "/locked")
 * @returns The normalized slug with a leading slash
 *
 * @example
 * ```typescript
 * normalizeLockPageSlug("locked")     // Returns: "/locked"
 * normalizeLockPageSlug("/locked")    // Returns: "/locked"
 * normalizeLockPageSlug("/maintenance/page")  // Returns: "/maintenance/page"
 * ```
 */
export function normalizeLockPageSlug(lockPageSlug: string): string {
  return lockPageSlug.startsWith("/") ? lockPageSlug : `/${lockPageSlug}`
}

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
  const normalizedSlug = normalizeLockPageSlug(lockPageSlug)
  return new URL(normalizedSlug, requestUrl)
}

/**
 * Checks if the current request is already on the lock page.
 * This is used to prevent infinite redirect loops when the site is locked.
 *
 * @param lockPageSlug - The slug/path of the lock page (e.g., "locked" or "/locked")
 * @param requestUrl - The current request URL to check
 * @returns True if the request is already on the lock page
 *
 * @example
 * ```typescript
 * isOnLockPage("locked", "https://example.com/locked")
 * // Returns: true
 *
 * isOnLockPage("/maintenance", "https://example.com/dashboard")
 * // Returns: false
 *
 * isOnLockPage("maintenance", "https://example.com/maintenance?foo=bar")
 * // Returns: true (query params are ignored)
 * ```
 */
export function isOnLockPage(
  lockPageSlug: string,
  requestUrl: string | URL,
): boolean {
  const normalizedSlug = normalizeLockPageSlug(lockPageSlug)
  const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl
  return url.pathname === normalizedSlug
}

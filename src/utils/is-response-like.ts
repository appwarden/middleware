/**
 * Loosely check if a value behaves like a Fetch/Cloudflare Response.
 *
 * In some deployed environments (e.g. TanStack Start on Cloudflare), the
 * object returned from `next()` may not be an actual instance of the global
 * Response constructor, which makes `instanceof Response` unreliable across
 * realms/bundlers. Instead, we check for the minimal surface we rely on in
 * the CSP middleware.
 */
export const isResponseLike = (value: unknown): value is Response => {
  if (!value || typeof value !== "object") return false
  const candidate = value as any
  const headers = candidate.headers
  return !!(
    headers &&
    typeof headers === "object" &&
    typeof headers.has === "function" &&
    typeof headers.set === "function" &&
    typeof headers.get === "function" &&
    "body" in candidate
  )
}

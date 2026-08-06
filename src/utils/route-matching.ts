import {
  AppwardenMiddlewareConfig,
  AppwardenMultidomainConfig,
  ResolvedMiddlewareConfig,
} from "../schemas"

interface ResolveMiddlewareConfigInput {
  debug: boolean
  lockPageSlug?: string
  multidomainConfig?: AppwardenMultidomainConfig
  appwardenMiddleware?: AppwardenMiddlewareConfig[]
}

/**
 * Normalizes a path pattern by stripping a trailing `/*` wildcard indicator
 * and any trailing slash. The wildcard is only a visual convention; matching
 * is governed by segment-boundary rules in `pathMatchesPattern`.
 */
function normalizePathPattern(pattern: string): string {
  if (pattern === "/") return pattern
  let normalized = pattern
  if (normalized.endsWith("/*")) {
    normalized = normalized.slice(0, -2)
  }
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

/**
 * Checks whether a request path matches a path pattern using segment-boundary rules.
 *
 * A pattern matches when:
 * - The request path is exactly the normalized pattern.
 * - The request path starts with the normalized pattern followed by `/`.
 * - The normalized pattern is `/`, in which case any path matches.
 *
 * This ensures `/api` matches `/api` and `/api/users`, but not `/api-docs`.
 * Use `/` with care: it is effectively a wildcard that matches every path.
 */
export function pathMatchesPattern(
  requestPath: string,
  pattern: string,
): boolean {
  const normalized = normalizePathPattern(pattern)

  if (normalized === "/") {
    return true
  }

  if (requestPath === normalized) {
    return true
  }

  if (requestPath.startsWith(`${normalized}/`)) {
    return true
  }

  return false
}

/**
 * Checks whether a request path matches any of the provided path patterns.
 */
export function pathMatchesAnyPattern(
  requestPath: string,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => pathMatchesPattern(requestPath, pattern))
}

/**
 * Finds the matching middleware entry for a hostname.
 *
 * Supports exact matches and common www variants:
 * - example.com matches example.com
 * - www.example.com matches example.com and vice versa
 */
export function findMiddlewareConfigForHostname(
  middleware: AppwardenMiddlewareConfig[],
  hostname: string,
): AppwardenMiddlewareConfig | undefined {
  const normalizedHostname = hostname.toLowerCase()
  const wwwHostname = normalizedHostname.startsWith("www.")
    ? normalizedHostname.slice(4)
    : `www.${normalizedHostname}`

  return middleware.find(
    (entry) =>
      entry.url.toLowerCase() === normalizedHostname ||
      entry.url.toLowerCase() === wwwHostname,
  )
}

/**
 * Resolves the effective middleware configuration for a request.
 *
 * When the new `appwardenMiddleware` array is present, it looks up the config
 * by hostname. Otherwise, it synthesizes a config from the legacy
 * `lockPageSlug` and `multidomainConfig` fields, using
 * `multidomainConfig[hostname].contentSecurityPolicy` for CSP settings.
 */
export function resolveMiddlewareConfig(
  input: ResolveMiddlewareConfigInput,
  hostname: string,
): ResolvedMiddlewareConfig | undefined {
  if (input.appwardenMiddleware && input.appwardenMiddleware.length > 0) {
    const entry = findMiddlewareConfigForHostname(
      input.appwardenMiddleware,
      hostname,
    )
    if (!entry) {
      return undefined
    }

    return {
      debug: entry.options.debug ?? input.debug,
      bypassPaths: entry.options.bypassPaths,
      website: entry.options.website,
      api: entry.options.api,
    }
  }

  const multidomainEntry = input.multidomainConfig?.[hostname]
  const lockPageSlug = multidomainEntry?.lockPageSlug ?? input.lockPageSlug

  if (!lockPageSlug) {
    return undefined
  }

  return {
    debug: multidomainEntry?.debug ?? input.debug,
    bypassPaths: undefined,
    website: {
      lockPageSlug,
      cspMode: multidomainEntry?.contentSecurityPolicy?.mode,
      cspDirectives: multidomainEntry?.contentSecurityPolicy?.directives,
    },
    api: undefined,
  }
}

/**
 * Builds a Headers object from the configured API lock response headers.
 */
export function buildApiLockResponseHeaders(
  headers: { name: string; value: string }[] | undefined,
): Headers {
  const result = new Headers()
  if (headers) {
    for (const { name, value } of headers) {
      result.set(name, value)
    }
  }
  return result
}

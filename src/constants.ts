export const LOCKDOWN_TEST_EXPIRY_MS = 5 * 60 * 1000

export const errors = { badCacheConnection: "BAD_CACHE_CONNECTION" }

export const globalErrors = [errors.badCacheConnection]

export const APPWARDEN_TEST_ROUTE = "/_appwarden/test"

export const APPWARDEN_HEARTBEAT_ROUTE = "/_appwarden/heartbeat"

export const APPWARDEN_CACHE_KEY = "appwarden-lock" as const

/**
 * Service identifiers for different middleware adapters.
 * These are hardcoded per adapter bundle.
 */
export const HEARTBEAT_SERVICES = {
  CLOUDFLARE: "cloudflare" as const,
  CLOUDFLARE_ASTRO: "cloudflare-astro" as const,
  CLOUDFLARE_REACT_ROUTER: "cloudflare-react-router" as const,
  CLOUDFLARE_TANSTACK_START: "cloudflare-tanstack-start" as const,
  CLOUDFLARE_NEXTJS: "cloudflare-nextjs" as const,
  VERCEL: "vercel" as const,
}

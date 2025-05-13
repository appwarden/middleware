export const LOCKDOWN_TEST_EXPIRY_MS = 5 * 60 * 1000

export const removedHeaders = ["X-Powered-By", "Server"]

export const securityHeaders = [
  // ["Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"],
  ["X-Frame-Options", "DENY"],
  ["X-XSS-Protection", "1; mode=block"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer, strict-origin-when-cross-origin"],
  ["X-DNS-Prefetch-Control", "on"],
]

export const errors = { badCacheConnection: "BAD_CACHE_CONNECTION" }

export const globalErrors = [errors.badCacheConnection]

export const APPWARDEN_TEST_ROUTE = "/_appwarden/test"

export const APPWARDEN_USER_AGENT = "Appwarden-Monitor" as const

export const APPWARDEN_CACHE_KEY = "appwarden-lock" as const

export const LOCKDOWN_TEST_EXPIRY_MS = 5 * 60 * 1000

export const errors = { badCacheConnection: "BAD_CACHE_CONNECTION" }

export const globalErrors = [errors.badCacheConnection]

export const APPWARDEN_TEST_ROUTE = "/_appwarden/test"

export const APPWARDEN_HEARTBEAT_ROUTE = "/_appwarden/heartbeat"

export const HEARTBEAT_CONTRACT_VERSION = 1 as const

/**
 * Maximum number of public heartbeat config errors.
 * Prevents unbounded response sizes.
 */
export const HEARTBEAT_CONFIG_ERROR_MAX_COUNT = 10

/**
 * Maximum path depth for public heartbeat config errors.
 * Prevents deeply nested paths from being exposed.
 */
export const HEARTBEAT_CONFIG_ERROR_MAX_PATH_DEPTH = 10

/**
 * Maximum length for public heartbeat config error codes.
 * Keeps error codes within the contract bounds.
 */
export const HEARTBEAT_CONFIG_ERROR_MAX_CODE_LENGTH = 100

/**
 * Maximum length for public heartbeat config error messages.
 * Prevents excessively long messages from being exposed.
 */
export const HEARTBEAT_CONFIG_ERROR_MAX_MESSAGE_LENGTH = 500

/**
 * Maximum length for individual public heartbeat config error path segments.
 * Prevents excessively long path segments from being exposed.
 */
export const HEARTBEAT_CONFIG_ERROR_MAX_PATH_SEGMENT_LENGTH = 100

export const APPWARDEN_CACHE_KEY = "appwarden-lock" as const

export const HEARTBEAT_SERVICE_VALUES = [
  "cloudflare",
  "cloudflare-astro",
  "cloudflare-react-router",
  "cloudflare-tanstack-start",
  "cloudflare-nextjs",
  "vercel",
] as const

const [
  CLOUDFLARE,
  CLOUDFLARE_ASTRO,
  CLOUDFLARE_REACT_ROUTER,
  CLOUDFLARE_TANSTACK_START,
  CLOUDFLARE_NEXTJS,
  VERCEL,
] = HEARTBEAT_SERVICE_VALUES

/**
 * Service identifiers for different middleware adapters.
 * These are hardcoded per adapter bundle.
 */
export const HEARTBEAT_SERVICES = {
  CLOUDFLARE,
  CLOUDFLARE_ASTRO,
  CLOUDFLARE_REACT_ROUTER,
  CLOUDFLARE_TANSTACK_START,
  CLOUDFLARE_NEXTJS,
  VERCEL,
} as const

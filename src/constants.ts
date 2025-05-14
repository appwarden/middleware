export const LOCKDOWN_TEST_EXPIRY_MS = 5 * 60 * 1000

export const errors = { badCacheConnection: "BAD_CACHE_CONNECTION" }

export const globalErrors = [errors.badCacheConnection]

export const APPWARDEN_TEST_ROUTE = "/_appwarden/test"

export const APPWARDEN_USER_AGENT = "Appwarden-Monitor" as const

export const APPWARDEN_CACHE_KEY = "appwarden-lock" as const

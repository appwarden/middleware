import { vi } from "vitest"

// Define build-time globals that are normally injected by tsup.config.ts
// These values match the non-production build configuration
vi.stubGlobal("DEBUG", true)
vi.stubGlobal("API_HOSTNAME", "https://staging-api.appwarden.io")
vi.stubGlobal("API_PATHNAME", "/v1/status/check")
vi.stubGlobal("CACHE_EXPIRY_MS", 30_000)

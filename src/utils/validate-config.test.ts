import { describe, expect, it, vi } from "vitest"
import { AppwardenConfigSchema } from "../schemas/vercel"
import { validateConfig } from "./validate-config"

describe("validateConfig", () => {
  it("should log the Vercel token error with the [@appwarden/middleware] prefix", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    const invalidConfig = {
      cacheUrl: "https://edge-config.vercel.com/ecfg_123?token=abc",
      vercelApiToken: "vercel-token",
      lockPageSlug: "/maintenance",
    }

    validateConfig(invalidConfig, AppwardenConfigSchema)

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "[@appwarden/middleware] APPWARDEN_API_TOKEN is missing or empty",
      ),
    )

    consoleError.mockRestore()
  })
})

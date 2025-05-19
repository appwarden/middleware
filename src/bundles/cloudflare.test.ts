import { describe, expect, it, vi } from "vitest"
import { appwardenOnCloudflare } from "../runners/appwarden-on-cloudflare"
import { useContentSecurityPolicy, withAppwarden } from "./cloudflare"

// Mock the imported modules
vi.mock("../runners/appwarden-on-cloudflare", () => ({
  appwardenOnCloudflare: vi.fn(),
}))

vi.mock("../middlewares", () => ({
  useContentSecurityPolicy: vi.fn(),
}))

describe("cloudflare bundle", () => {
  it("should export withAppwarden as appwardenOnCloudflare", () => {
    expect(withAppwarden).toBe(appwardenOnCloudflare)
  })

  it("should export useContentSecurityPolicy middleware", () => {
    expect(useContentSecurityPolicy).toBeDefined()
  })
})

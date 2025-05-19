import { describe, expect, it, vi } from "vitest"
import { BaseNextJsConfigSchema, withAppwarden } from "./vercel"
import { appwardenOnVercel } from "../runners/appwarden-on-vercel"

// Mock the imported modules
vi.mock("../runners/appwarden-on-vercel", () => ({
  appwardenOnVercel: vi.fn(),
}))

vi.mock("../schemas/vercel", () => ({
  BaseNextJsConfigSchema: {},
}))

describe("vercel bundle", () => {
  it("should export withAppwarden as appwardenOnVercel", () => {
    expect(withAppwarden).toBe(appwardenOnVercel)
  })

  it("should export BaseNextJsConfigSchema", () => {
    expect(BaseNextJsConfigSchema).toBeDefined()
  })
})

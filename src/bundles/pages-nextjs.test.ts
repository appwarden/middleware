import { describe, expect, it, vi } from "vitest"
import { withAppwardenOnNextJs } from "./pages-nextjs"
import { appwardenOnPagesNextJs } from "../runners/appwarden-on-pages-next-js"

// Mock the imported modules
vi.mock("../runners/appwarden-on-pages-next-js", () => ({
  appwardenOnPagesNextJs: vi.fn(),
}))

describe("pages-nextjs bundle", () => {
  it("should export withAppwardenOnNextJs as appwardenOnPagesNextJs", () => {
    expect(withAppwardenOnNextJs).toBe(appwardenOnPagesNextJs)
  })
})

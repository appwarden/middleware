import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { debug } from "./debug"

describe("debug", () => {
  const originalConsoleLog = console.log

  beforeEach(() => {
    console.log = vi.fn()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    vi.resetAllMocks()
  })

  it("should log messages when DEBUG is true", () => {
    // Mock the DEBUG global variable
    vi.stubGlobal("DEBUG", true)

    debug("test message")

    expect(console.log).toHaveBeenCalledWith("test message")
  })

  it("should not log messages when DEBUG is false", () => {
    // Mock the DEBUG global variable
    vi.stubGlobal("DEBUG", false)

    debug("test message")

    expect(console.log).not.toHaveBeenCalled()
  })

  it("should handle multiple arguments", () => {
    // Mock the DEBUG global variable
    vi.stubGlobal("DEBUG", true)

    debug("message 1", "message 2", { key: "value" })

    expect(console.log).toHaveBeenCalledWith("message 1", "message 2", {
      key: "value",
    })
  })
})

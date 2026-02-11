import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { debug } from "./debug"

describe("debug", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    vi.resetAllMocks()
  })

  it("should log messages when DEBUG is true", () => {
    // Mock the DEBUG global variable
    vi.stubGlobal("DEBUG", true)

    debug("test message")

    expect(consoleLogSpy).toHaveBeenCalledWith("test message")
  })

  it("should not log messages when DEBUG is false", () => {
    // Mock the DEBUG global variable
    vi.stubGlobal("DEBUG", false)

    debug("test message")

    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it("should handle multiple arguments", () => {
    // Mock the DEBUG global variable
    vi.stubGlobal("DEBUG", true)

    debug("message 1", "message 2", { key: "value" })

    // Objects are stringified to ensure readable output in Cloudflare Workers
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "message 1",
      "message 2",
      '{"key":"value"}',
    )
  })

  it("should handle circular references gracefully", () => {
    vi.stubGlobal("DEBUG", true)

    // Create an object with a circular reference
    const circularObj: Record<string, unknown> = { name: "test" }
    circularObj.self = circularObj

    // Should not throw and should fall back to String()
    debug("circular:", circularObj)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "circular:",
      "[object Object]",
    )
  })

  it("should handle Error objects with stack trace", () => {
    vi.stubGlobal("DEBUG", true)

    const error = new Error("test error")

    debug("error:", error)

    // Error objects should show stack or message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "error:",
      expect.stringContaining("test error"),
    )
  })
})

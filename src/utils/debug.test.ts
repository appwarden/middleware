import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Stub printMessage so we can assert on the raw content produced by debug
vi.mock("./print-message", () => ({
  printMessage: (message: string) => message,
}))

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

  it("logs messages when enabled", () => {
    const log = debug(true)

    log("test message")

    expect(consoleLogSpy).toHaveBeenCalledWith("test message")
  })

  it("does not log messages when disabled", () => {
    const log = debug(false)

    log("test message")

    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it("handles multiple arguments and stringifies objects", () => {
    const log = debug(true)

    log("message 1", "message 2", { key: "value" })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "message 1",
      "message 2",
      '{"key":"value"}',
    )
  })

  it("handles circular references gracefully", () => {
    const log = debug(true)

    // Create an object with a circular reference
    const circularObj: Record<string, unknown> = { name: "test" }
    circularObj.self = circularObj

    // Should not throw and should fall back to String()
    log("circular:", circularObj)

    expect(consoleLogSpy).toHaveBeenCalledWith("circular:", "[object Object]")
  })

  it("handles Error objects with stack trace", () => {
    const log = debug(true)

    const error = new Error("test error")

    log("error:", error)

    // Error objects should show stack or message
    const lastCallArgs = consoleLogSpy.mock.calls.at(-1) ?? []
    expect(lastCallArgs[0]).toBe("error:")
    expect(String(lastCallArgs[1])).toContain("test error")
  })
})

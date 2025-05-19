import { describe, expect, it } from "vitest"
import { NextJsConfigFnOutputSchema } from "./nextjs"

describe("NextJsConfigFnOutputSchema", () => {
  it("should validate a valid function", () => {
    // Create a valid function that returns a valid config
    const validFn = (context: any) => ({
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    })

    // Parse the function
    const result = NextJsConfigFnOutputSchema.safeParse(validFn)

    // Verify the function was parsed correctly
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data).toBe("function")
    }
  })

  it("should reject a non-function value", () => {
    // Try to parse a non-function value
    expect(NextJsConfigFnOutputSchema.safeParse({}).success).toBe(false)
    expect(NextJsConfigFnOutputSchema.safeParse("not a function").success).toBe(
      false,
    )
    expect(NextJsConfigFnOutputSchema.safeParse(123).success).toBe(false)
  })

  it("should accept a function with the correct signature", () => {
    // Create a function with the correct signature
    const validFn = (context: any) => ({
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    })

    // Parse the function
    const result = NextJsConfigFnOutputSchema.safeParse(validFn)

    // Verify the function was parsed correctly
    expect(result.success).toBe(true)
  })
})

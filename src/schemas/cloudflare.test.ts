import { describe, expect, it } from "vitest"
import { ConfigFnInputSchema } from "./cloudflare"

describe("ConfigFnInputSchema", () => {
  it("should validate a valid function", () => {
    // Create a valid function that returns a valid config
    const validFn = (context: any) => ({
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
      middleware: {
        before: [
          async (ctx: any, next: any) => {
            // Mock middleware function
            await next()
          },
        ],
      },
    })

    // Parse the function
    const result = ConfigFnInputSchema.safeParse(validFn)

    // Verify the function was parsed correctly
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data).toBe("function")
    }
  })

  it("should accept a function with the correct signature", () => {
    // Create a valid function without middleware
    const validFn = (context: any) => ({
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
      // No middleware specified
    })

    // Parse the function
    const result = ConfigFnInputSchema.safeParse(validFn)

    // Verify the function was parsed correctly
    expect(result.success).toBe(true)
  })

  it("should reject a non-function value", () => {
    // Try to parse a non-function value
    expect(ConfigFnInputSchema.safeParse({}).success).toBe(false)
    expect(ConfigFnInputSchema.safeParse("not a function").success).toBe(false)
    expect(ConfigFnInputSchema.safeParse(123).success).toBe(false)
  })
})

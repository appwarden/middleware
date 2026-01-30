import { describe, expect, it } from "vitest"
import {
  lockPageSlugRefinement,
  UseAppwardenInputSchema,
} from "./use-appwarden"

// Instead of mocking, we'll test the behavior of the schema
// This approach is more resilient to implementation changes

describe("UseAppwardenInputSchema", () => {
  it("should validate a valid input", () => {
    const validInput = {
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject(validInput)
    }
  })

  it("should validate a valid input with string debug value", () => {
    const validInput = {
      debug: "true",
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debug).toBe(true) // Should be transformed to boolean
      expect(result.data.lockPageSlug).toBe("/maintenance")
      expect(result.data.appwardenApiToken).toBe("token123")
    }
  })

  it("should default debug to false when not provided", () => {
    const validInput = {
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debug).toBe(false)
      expect(result.data.lockPageSlug).toBe("/maintenance")
      expect(result.data.appwardenApiToken).toBe("token123")
    }
  })

  it("should allow lockPageSlug to be optional in base schema", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
    }

    // Base schema allows optional lockPageSlug
    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("should accept multidomainConfig instead of lockPageSlug", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      multidomainConfig: {
        "example.com": { lockPageSlug: "/maintenance-example" },
        "other.com": { lockPageSlug: "/maintenance-other" },
      },
    }

    const result = UseAppwardenInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.multidomainConfig).toEqual(
        validInput.multidomainConfig,
      )
    }
  })

  it("should require either lockPageSlug or multidomainConfig when using refinement", () => {
    const invalidInput = {
      debug: true,
      appwardenApiToken: "token123",
    }

    const RefinedSchema = lockPageSlugRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it("should pass refinement when lockPageSlug is provided", () => {
    const validInput = {
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    }

    const RefinedSchema = lockPageSlugRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("should pass refinement when multidomainConfig is provided", () => {
    const validInput = {
      debug: true,
      appwardenApiToken: "token123",
      multidomainConfig: {
        "example.com": { lockPageSlug: "/maintenance" },
      },
    }

    const RefinedSchema = lockPageSlugRefinement(UseAppwardenInputSchema)
    const result = RefinedSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("should require appwardenApiToken", () => {
    const invalidInput = {
      debug: true,
      lockPageSlug: "/maintenance",
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it("should reject empty appwardenApiToken", () => {
    const invalidInput = {
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "",
    }

    const result = UseAppwardenInputSchema.safeParse(invalidInput)
    expect(result.success).toBe(false)
  })

  it("should reject invalid debug values", () => {
    // The actual implementation throws an error for invalid debug values
    // This test is adjusted to match the actual behavior
    const invalidInput = {
      debug: "not-a-boolean",
      lockPageSlug: "/maintenance",
      appwardenApiToken: "token123",
    }

    expect(() => UseAppwardenInputSchema.parse(invalidInput)).toThrow(
      "Invalid value",
    )
  })
})

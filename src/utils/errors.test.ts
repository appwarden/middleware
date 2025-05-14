import { describe, expect, it, vi } from "vitest"
import { z, ZodError } from "zod"
import { getErrors, SchemaErrorKey } from "./errors"

describe("errors", () => {
  describe("SchemaErrorKey", () => {
    it("should define the expected error keys", () => {
      expect(SchemaErrorKey.DirectivesRequired).toBe("DirectivesRequired")
      expect(SchemaErrorKey.DirectivesBadParse).toBe("DirectivesBadParse")
    })
  })

  describe("getErrors", () => {
    it("should extract error messages for simple field errors", () => {
      // Create a schema with validation rules
      const schema = z.object({
        mode: z.enum(["disabled", "report-only", "enforced"]),
      })

      // Create an error by validating invalid data
      let error: ZodError
      try {
        schema.parse({ mode: "invalid" })
        throw new Error("Should have failed validation")
      } catch (e) {
        error = e as ZodError
      }

      const errors = getErrors(error)

      // Should extract the mode error message
      expect(errors).toContain(
        '`CSP_MODE` must be one of "disabled", "report-only", or "enforced"',
      )
    })

    it("should extract error messages for appwardenApiToken", () => {
      // Create a schema with validation rules
      const schema = z.object({
        appwardenApiToken: z.string().min(1),
      })

      // Create an error by validating invalid data
      let error: ZodError
      try {
        schema.parse({})
        throw new Error("Should have failed validation")
      } catch (e) {
        error = e as ZodError
      }

      const errors = getErrors(error)

      // Should extract the appwardenApiToken error message
      expect(errors).toContain(
        "Please provide a valid `appwardenApiToken`. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      )
    })

    it("should handle nested directives errors with custom error code", () => {
      // Create a mock ZodError with a custom error code for directives
      const mockError = new ZodError([])

      // Mock the flatten method to return fieldErrors with directives and the custom error code
      mockError.flatten = vi.fn().mockReturnValue({
        fieldErrors: {
          directives: [SchemaErrorKey.DirectivesBadParse],
        },
        formErrors: [],
      })

      const errors = getErrors(mockError)

      // Should extract the directives error message
      expect(errors).toContain(
        "Failed to parse `CSP_DIRECTIVES`. Is it a valid JSON string?",
      )
    })

    it("should handle DirectivesRequired error code", () => {
      // Create a mock ZodError with DirectivesRequired error code
      const mockError = new ZodError([])

      // Mock the flatten method to return fieldErrors with directives and the DirectivesRequired code
      mockError.flatten = vi.fn().mockReturnValue({
        fieldErrors: {
          directives: [SchemaErrorKey.DirectivesRequired],
        },
        formErrors: [],
      })

      const errors = getErrors(mockError)

      // Should extract the directives error message
      expect(errors).toContain(
        '`CSP_DIRECTIVES` must be provided when `CSP_MODE` is "report-only" or "enforced"',
      )
    })

    it("should handle returnTypeError in ZodInvalidReturnTypeIssue", () => {
      // Create a mock ZodError with a returnTypeError
      const mockError = new ZodError([])

      // Create a mock issue with returnTypeError
      const mockIssue = {
        code: "invalid_return_type",
        expected: "object",
        received: "undefined",
        path: [],
        message: "Invalid return type",
        returnTypeError: {
          flatten: () => ({
            fieldErrors: {
              appwardenApiToken: ["Required"],
            },
            formErrors: [],
          }),
        },
      }

      // Add the mock issue to the error
      mockError.issues = [mockIssue as any]

      const errors = getErrors(mockError)

      // Should extract the appwardenApiToken error message from returnTypeError
      expect(errors).toContain(
        "Please provide a valid `appwardenApiToken`. Learn more at https://appwarden.com/docs/guides/api-token-management.",
      )
    })
  })
})

import { describe, expect, it, vi } from "vitest"
import { SchemaErrorKey } from "../utils"
import {
  CSPDirectivesSchema,
  CSPModeSchema,
  UseCSPInputSchema,
} from "./use-content-security-policy"

// Mock the SchemaErrorKey enum
vi.mock("../utils", () => ({
  SchemaErrorKey: {
    DirectivesRequired: "DirectivesRequired",
    DirectivesBadParse: "DirectivesBadParse",
  },
}))

describe("CSPModeSchema", () => {
  it("should accept valid modes", () => {
    expect(CSPModeSchema.parse("disabled")).toBe("disabled")
    expect(CSPModeSchema.parse("report-only")).toBe("report-only")
    expect(CSPModeSchema.parse("enforced")).toBe("enforced")
  })

  it("should default to 'disabled' when not provided", () => {
    expect(CSPModeSchema.parse(undefined)).toBe("disabled")
  })

  it("should reject invalid modes", () => {
    expect(() => CSPModeSchema.parse("invalid")).toThrow()
    expect(() => CSPModeSchema.parse(123)).toThrow()
    expect(() => CSPModeSchema.parse({})).toThrow()
  })
})

describe("CSPDirectivesSchema", () => {
  it("should accept valid string JSON", () => {
    const validJson = JSON.stringify({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
    })
    expect(CSPDirectivesSchema.parse(validJson)).toBe(validJson)
  })

  it("should accept ContentSecurityPolicySchema objects", () => {
    const validObject = {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
    }
    expect(CSPDirectivesSchema.parse(validObject)).toEqual(validObject)
  })

  it("should accept string values for directives", () => {
    const validObject = {
      "default-src": "'self'",
      "script-src": "'self' 'unsafe-inline'",
    }
    expect(CSPDirectivesSchema.parse(validObject)).toEqual(validObject)
  })

  it("should accept boolean values for directives", () => {
    const validObject = {
      "default-src": true,
      "upgrade-insecure-requests": true,
    }
    expect(CSPDirectivesSchema.parse(validObject)).toEqual(validObject)
  })
})

describe("UseCSPInputSchema", () => {
  it("should validate valid inputs with object directives", () => {
    const validInput = {
      mode: "enforced",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
      },
    }
    const result = UseCSPInputSchema.parse(validInput)
    expect(result).toEqual(validInput)
  })

  it("should validate valid inputs with string directives", () => {
    const stringDirectives = JSON.stringify({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
    })
    const validInput = {
      mode: "enforced",
      directives: stringDirectives,
    }
    const result = UseCSPInputSchema.parse(validInput)
    expect(result).toEqual({
      mode: "enforced",
      directives: JSON.parse(stringDirectives),
    })
  })

  it("should transform string directives to objects", () => {
    const stringDirectives = JSON.stringify({
      "default-src": ["'self'"],
    })
    const result = UseCSPInputSchema.parse({
      mode: "report-only",
      directives: stringDirectives,
    })
    expect(result.directives).toEqual(JSON.parse(stringDirectives))
    expect(typeof result.directives).toBe("object")
  })

  it("should allow mode 'disabled' without directives", () => {
    const input = {
      mode: "disabled",
    }
    const result = UseCSPInputSchema.parse(input)
    expect(result).toEqual({
      mode: "disabled",
      directives: undefined,
    })
  })

  it("should require directives when mode is 'report-only'", () => {
    const input = {
      mode: "report-only",
    }
    expect(() => UseCSPInputSchema.parse(input)).toThrow(
      SchemaErrorKey.DirectivesRequired,
    )
  })

  it("should require directives when mode is 'enforced'", () => {
    const input = {
      mode: "enforced",
    }
    expect(() => UseCSPInputSchema.parse(input)).toThrow(
      SchemaErrorKey.DirectivesRequired,
    )
  })

  it("should reject invalid JSON string directives", () => {
    const input = {
      mode: "enforced",
      directives: "{invalid-json}",
    }
    expect(() => UseCSPInputSchema.parse(input)).toThrow(
      SchemaErrorKey.DirectivesBadParse,
    )
  })

  it("should handle empty directives object", () => {
    const input = {
      mode: "enforced",
      directives: {},
    }
    const result = UseCSPInputSchema.parse(input)
    expect(result).toEqual(input)
  })

  it("should handle complex directives", () => {
    const input = {
      mode: "enforced",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://example.com"],
        "style-src": "'self' 'unsafe-inline'",
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://api.example.com"],
        "font-src": "'self'",
        "object-src": "'none'",
        "media-src": "'self'",
        "frame-src": "https://trusted-site.com",
        "upgrade-insecure-requests": true,
      },
    }
    const result = UseCSPInputSchema.parse(input)
    expect(result).toEqual(input)
  })

  it("should allow optional hostname configuration", () => {
    const input = {
      mode: "enforced",
      hostname: "example.com",
      directives: {
        "default-src": ["'self'"],
      },
    }
    const result = UseCSPInputSchema.parse(input)
    expect(result).toEqual(input)
  })
})

import { describe, expect, it } from "vitest"
import { UseCSPInput } from "../../schemas"
import { ContentSecurityPolicyType } from "../../types"
import { makeCSPHeader } from "./make-csp-header"

describe("makeCSPHeader", () => {
  const testNonce = "test-nonce-123"

  it("should create a CSP header with enforced mode", () => {
    const directives: ContentSecurityPolicyType = {
      "default-src": ["'self'", "{{nonce}}"],
      "script-src": ["'self'", "{{nonce}}", "https://example.com"],
    }
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toContain("default-src 'self' 'nonce-test-nonce-123'")
    expect(headerValue).toContain(
      "script-src 'self' 'nonce-test-nonce-123' https://example.com",
    )
  })

  it("should create a CSP header with report-only mode", () => {
    const directives: ContentSecurityPolicyType = {
      "default-src": ["'self'", "{{nonce}}"],
    }
    const mode: UseCSPInput["mode"] = "report-only"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy-Report-Only")
    expect(headerValue).toBe("default-src 'self' 'nonce-test-nonce-123'")
  })

  it("should handle empty directives", () => {
    const directives = undefined
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toBe("")
  })

  it("should handle boolean directive values", () => {
    const directives = {
      "upgrade-insecure-requests": true,
      "block-all-mixed-content": true,
      "unsafe-eval": false,
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toContain("upgrade-insecure-requests")
    expect(headerValue).toContain("block-all-mixed-content")
    expect(headerValue).not.toContain("unsafe-eval")
  })

  it("should convert camelCase directive names to kebab-case", () => {
    const directives: ContentSecurityPolicyType = {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
    }
    const mode: UseCSPInput["mode"] = "enforced"

    const [, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerValue).toContain("default-src")
    expect(headerValue).toContain("script-src")
    expect(headerValue).toContain("connect-src")
    expect(headerValue).toContain("frame-ancestors")
  })

  it("should replace {{nonce}} placeholder with actual nonce value", () => {
    const directives: ContentSecurityPolicyType = {
      "script-src": ["{{nonce}}", "'self'"],
      "style-src": ["{{nonce}}", "'self'"],
    }
    const mode: UseCSPInput["mode"] = "enforced"

    const [, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerValue).toContain(`'nonce-${testNonce}'`)
    expect(headerValue).not.toContain("{{nonce}}")
  })

  it("should throw an error for duplicate directive names", () => {
    const directives = {
      defaultSrc: ["'self'"],
      "default-src": ["'none'"], // This should cause an error
    } as unknown as ContentSecurityPolicyType

    expect(() => {
      makeCSPHeader(testNonce, directives, "enforced")
    }).toThrow("default-src is specified more than once")
  })

  it("should join array values with spaces", () => {
    const directives: ContentSecurityPolicyType = {
      "script-src": [
        "'self'",
        "https://example.com",
        "https://cdn.example.com",
      ],
    }
    const mode: UseCSPInput["mode"] = "enforced"

    const [, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerValue).toBe(
      "script-src 'self' https://example.com https://cdn.example.com",
    )
  })

  it("should handle string values instead of arrays", () => {
    const directives = {
      "default-src": "'self'",
      "script-src": "'self' https://example.com",
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toContain("default-src 'self'")
    expect(headerValue).toContain("script-src 'self' https://example.com")
  })

  it("should handle mixed directive types (arrays, strings, booleans)", () => {
    const directives = {
      "default-src": ["'self'", "https://example.com"],
      "script-src": "'self' {{nonce}}",
      "upgrade-insecure-requests": true,
      "block-all-mixed-content": false,
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toContain("default-src 'self' https://example.com")
    expect(headerValue).toContain(`script-src 'self' 'nonce-${testNonce}'`)
    expect(headerValue).toContain("upgrade-insecure-requests")
    expect(headerValue).not.toContain("block-all-mixed-content")
  })

  it("should handle empty arrays", () => {
    const directives = {
      "default-src": [],
      "script-src": ["'self'"],
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    // An empty array will result in an empty string, which will be handled as a directive with no value
    expect(headerValue).toContain("default-src")
    expect(headerValue).toContain("script-src 'self'")
  })

  it("should handle complex camelCase to kebab-case conversion", () => {
    const directives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      requireTrustedTypesFor: ["'script'"],
      blockAllMixedContent: true,
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerValue).toContain("default-src 'self'")
    expect(headerValue).toContain("script-src 'self'")
    expect(headerValue).toContain("connect-src 'self'")
    expect(headerValue).toContain("frame-ancestors 'none'")
    expect(headerValue).toContain("require-trusted-types-for 'script'")
    expect(headerValue).toContain("block-all-mixed-content")
  })

  it("should handle nonce replacements in a string value", () => {
    const directives = {
      "script-src": "{{nonce}} 'self' https://example.com",
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    const nonceValue = `'nonce-${testNonce}'`
    expect(headerValue).toContain(
      `script-src ${nonceValue} 'self' https://example.com`,
    )
  })

  it("should handle a directive with no value (empty string)", () => {
    const directives = {
      "default-src": ["'self'"],
      "script-src": "",
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toContain("default-src 'self'")
    expect(headerValue).toContain("script-src")
    // The script-src directive should have no value after it
    expect(headerValue).toMatch(/script-src(?!\s[^\s;])/)
  })

  it("should handle a directive with a single value", () => {
    const directives = {
      "default-src": ["'none'"],
    } as unknown as ContentSecurityPolicyType
    const mode: UseCSPInput["mode"] = "enforced"

    const [headerName, headerValue] = makeCSPHeader(testNonce, directives, mode)

    expect(headerName).toBe("Content-Security-Policy")
    expect(headerValue).toBe("default-src 'none'")
  })

  describe("CSP keyword auto-quoting", () => {
    it("should auto-quote unquoted 'self' keyword in arrays", () => {
      const directives = {
        "script-src": ["self", "https://example.com"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe("script-src 'self' https://example.com")
    })

    it("should auto-quote unquoted 'none' keyword in arrays", () => {
      const directives = {
        "object-src": ["none"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe("object-src 'none'")
    })

    it("should auto-quote multiple unquoted keywords in arrays", () => {
      const directives = {
        "script-src": ["self", "unsafe-inline", "strict-dynamic"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(
        "script-src 'self' 'unsafe-inline' 'strict-dynamic'",
      )
    })

    it("should NOT double-quote already-quoted keywords in arrays", () => {
      const directives = {
        "script-src": ["'self'", "'unsafe-inline'"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe("script-src 'self' 'unsafe-inline'")
      // Ensure no double quotes
      expect(headerValue).not.toContain("''self''")
      expect(headerValue).not.toContain("''unsafe-inline''")
    })

    it("should handle mixed quoted and unquoted keywords in arrays", () => {
      const directives = {
        "script-src": ["'self'", "unsafe-inline", "https://example.com"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(
        "script-src 'self' 'unsafe-inline' https://example.com",
      )
    })

    it("should auto-quote unquoted keywords in string values", () => {
      const directives = {
        "script-src": "self unsafe-inline https://example.com",
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(
        "script-src 'self' 'unsafe-inline' https://example.com",
      )
    })

    it("should NOT double-quote already-quoted keywords in string values", () => {
      const directives = {
        "script-src": "'self' 'unsafe-inline'",
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe("script-src 'self' 'unsafe-inline'")
      expect(headerValue).not.toContain("''")
    })

    it("should preserve non-keyword values unchanged", () => {
      const directives = {
        "script-src": ["self", "an-elf", "https://cdn.example.com"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(
        "script-src 'self' an-elf https://cdn.example.com",
      )
    })

    it("should preserve nonce placeholders and auto-quote keywords", () => {
      const directives = {
        "script-src": ["self", "{{nonce}}", "an-elf"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(`script-src 'self' 'nonce-${testNonce}' an-elf`)
    })

    it("should preserve hash values and auto-quote keywords", () => {
      const directives = {
        "script-src": ["self", "'sha256-abc123def456'"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe("script-src 'self' 'sha256-abc123def456'")
    })

    it("should auto-quote all W3C CSP Level 3 keywords", () => {
      const directives = {
        "script-src": [
          "self",
          "none",
          "unsafe-inline",
          "unsafe-eval",
          "unsafe-hashes",
          "strict-dynamic",
          "wasm-unsafe-eval",
        ],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(
        "script-src 'self' 'none' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes' 'strict-dynamic' 'wasm-unsafe-eval'",
      )
    })

    it("should handle the real-world bug scenario from user config", () => {
      // This is the exact scenario from the bug report:
      // User provided: ["self", "an-elf", "{{nonce}}"]
      // Expected output: 'self' an-elf 'nonce-xxx'
      const directives = {
        "script-src": ["self", "an-elf", "{{nonce}}"],
      } as unknown as ContentSecurityPolicyType

      const [, headerValue] = makeCSPHeader(testNonce, directives, "enforced")

      expect(headerValue).toBe(`script-src 'self' an-elf 'nonce-${testNonce}'`)
      // Verify 'self' is properly quoted
      expect(headerValue).toContain("'self'")
      // Verify 'an-elf' is NOT quoted (it's not a keyword)
      expect(headerValue).toContain(" an-elf ")
    })
  })
})

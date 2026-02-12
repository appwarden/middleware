import { describe, expect, it } from "vitest"
import {
  autoQuoteCSPDirectiveArray,
  autoQuoteCSPDirectiveValue,
  autoQuoteCSPKeyword,
  CSP_KEYWORDS,
  isCSPKeyword,
  isQuoted,
} from "./csp-keywords"

describe("CSP Keywords", () => {
  describe("CSP_KEYWORDS constant", () => {
    it("should contain all W3C CSP Level 3 keywords", () => {
      expect(CSP_KEYWORDS).toContain("self")
      expect(CSP_KEYWORDS).toContain("none")
      expect(CSP_KEYWORDS).toContain("unsafe-inline")
      expect(CSP_KEYWORDS).toContain("unsafe-eval")
      expect(CSP_KEYWORDS).toContain("unsafe-hashes")
      expect(CSP_KEYWORDS).toContain("strict-dynamic")
      expect(CSP_KEYWORDS).toContain("report-sample")
      expect(CSP_KEYWORDS).toContain("unsafe-allow-redirects")
      expect(CSP_KEYWORDS).toContain("wasm-unsafe-eval")
      expect(CSP_KEYWORDS).toContain("trusted-types-eval")
      expect(CSP_KEYWORDS).toContain("report-sha256")
      expect(CSP_KEYWORDS).toContain("report-sha384")
      expect(CSP_KEYWORDS).toContain("report-sha512")
      expect(CSP_KEYWORDS).toContain("unsafe-webtransport-hashes")
    })

    it("should have exactly 14 keywords", () => {
      expect(CSP_KEYWORDS).toHaveLength(14)
    })
  })

  describe("isQuoted", () => {
    it.each([
      ["'self'", true],
      ["'none'", true],
      ["'unsafe-inline'", true],
      ["''", true],
      ["self", false],
      ["none", false],
      ["'self", false],
      ["self'", false],
      ["https://example.com", false],
      ["", false],
    ])("isQuoted(%s) should return %s", (value, expected) => {
      expect(isQuoted(value)).toBe(expected)
    })
  })

  describe("isCSPKeyword", () => {
    it.each([
      ["self", true],
      ["none", true],
      ["unsafe-inline", true],
      ["unsafe-eval", true],
      ["strict-dynamic", true],
      ["SELF", true], // case-insensitive
      ["Self", true], // case-insensitive
      ["UNSAFE-INLINE", true], // case-insensitive
      ["https://example.com", false],
      ["an-elf", false],
      ["nonce-abc123", false],
      ["sha256-abc123", false],
      ["{{nonce}}", false],
      ["", false],
    ])("isCSPKeyword(%s) should return %s", (value, expected) => {
      expect(isCSPKeyword(value)).toBe(expected)
    })
  })

  describe("autoQuoteCSPKeyword", () => {
    describe("unquoted keywords should be quoted", () => {
      it.each([
        ["self", "'self'"],
        ["none", "'none'"],
        ["unsafe-inline", "'unsafe-inline'"],
        ["unsafe-eval", "'unsafe-eval'"],
        ["unsafe-hashes", "'unsafe-hashes'"],
        ["strict-dynamic", "'strict-dynamic'"],
        ["report-sample", "'report-sample'"],
        ["unsafe-allow-redirects", "'unsafe-allow-redirects'"],
        ["wasm-unsafe-eval", "'wasm-unsafe-eval'"],
        ["trusted-types-eval", "'trusted-types-eval'"],
        ["report-sha256", "'report-sha256'"],
        ["report-sha384", "'report-sha384'"],
        ["report-sha512", "'report-sha512'"],
        ["unsafe-webtransport-hashes", "'unsafe-webtransport-hashes'"],
      ])("autoQuoteCSPKeyword(%s) should return %s", (input, expected) => {
        expect(autoQuoteCSPKeyword(input)).toBe(expected)
      })
    })

    describe("already-quoted keywords should NOT be double-quoted", () => {
      it.each([
        ["'self'", "'self'"],
        ["'none'", "'none'"],
        ["'unsafe-inline'", "'unsafe-inline'"],
        ["'unsafe-eval'", "'unsafe-eval'"],
        ["'strict-dynamic'", "'strict-dynamic'"],
      ])(
        "autoQuoteCSPKeyword(%s) should return %s (no double-quoting)",
        (input, expected) => {
          expect(autoQuoteCSPKeyword(input)).toBe(expected)
        },
      )
    })

    describe("non-keyword values should remain unchanged", () => {
      it.each([
        ["https://example.com", "https://example.com"],
        ["an-elf", "an-elf"],
        ["*.example.com", "*.example.com"],
        ["data:", "data:"],
        ["blob:", "blob:"],
        ["wss://example.com", "wss://example.com"],
      ])(
        "autoQuoteCSPKeyword(%s) should return %s (unchanged)",
        (input, expected) => {
          expect(autoQuoteCSPKeyword(input)).toBe(expected)
        },
      )
    })

    describe("nonce placeholders should remain unchanged", () => {
      it("should not quote {{nonce}} placeholder", () => {
        expect(autoQuoteCSPKeyword("{{nonce}}")).toBe("{{nonce}}")
      })
    })

    describe("hash values should remain unchanged", () => {
      it.each([
        "'sha256-abc123def456'",
        "'sha384-abc123def456'",
        "'sha512-abc123def456'",
        "'nonce-abc123def456'",
      ])("autoQuoteCSPKeyword(%s) should return unchanged", (input) => {
        expect(autoQuoteCSPKeyword(input)).toBe(input)
      })
    })

    describe("idempotency", () => {
      it("should be idempotent - multiple calls produce same result", () => {
        const input = "self"
        const firstCall = autoQuoteCSPKeyword(input)
        const secondCall = autoQuoteCSPKeyword(firstCall)
        const thirdCall = autoQuoteCSPKeyword(secondCall)

        expect(firstCall).toBe("'self'")
        expect(secondCall).toBe("'self'")
        expect(thirdCall).toBe("'self'")
      })
    })
  })

  describe("autoQuoteCSPDirectiveValue", () => {
    it("should quote unquoted keywords in a space-separated string", () => {
      expect(autoQuoteCSPDirectiveValue("self https://example.com")).toBe(
        "'self' https://example.com",
      )
    })

    it("should quote multiple unquoted keywords", () => {
      expect(autoQuoteCSPDirectiveValue("self unsafe-inline none")).toBe(
        "'self' 'unsafe-inline' 'none'",
      )
    })

    it("should not double-quote already-quoted keywords", () => {
      expect(autoQuoteCSPDirectiveValue("'self' none")).toBe("'self' 'none'")
    })

    it("should handle mixed quoted and unquoted keywords", () => {
      expect(
        autoQuoteCSPDirectiveValue("'self' unsafe-inline https://example.com"),
      ).toBe("'self' 'unsafe-inline' https://example.com")
    })

    it("should preserve nonce placeholders", () => {
      expect(autoQuoteCSPDirectiveValue("self {{nonce}}")).toBe(
        "'self' {{nonce}}",
      )
    })
  })

  describe("autoQuoteCSPDirectiveArray", () => {
    it("should quote unquoted keywords in an array", () => {
      expect(
        autoQuoteCSPDirectiveArray(["self", "https://example.com"]),
      ).toEqual(["'self'", "https://example.com"])
    })

    it("should quote multiple unquoted keywords", () => {
      expect(
        autoQuoteCSPDirectiveArray(["self", "unsafe-inline", "none"]),
      ).toEqual(["'self'", "'unsafe-inline'", "'none'"])
    })

    it("should not double-quote already-quoted keywords", () => {
      expect(autoQuoteCSPDirectiveArray(["'self'", "none"])).toEqual([
        "'self'",
        "'none'",
      ])
    })

    it("should handle mixed arrays with keywords, URLs, and nonces", () => {
      expect(
        autoQuoteCSPDirectiveArray([
          "self",
          "'unsafe-inline'",
          "https://example.com",
          "{{nonce}}",
          "an-elf",
        ]),
      ).toEqual([
        "'self'",
        "'unsafe-inline'",
        "https://example.com",
        "{{nonce}}",
        "an-elf",
      ])
    })

    it("should preserve hash values", () => {
      expect(autoQuoteCSPDirectiveArray(["self", "'sha256-abc123'"])).toEqual([
        "'self'",
        "'sha256-abc123'",
      ])
    })
  })
})

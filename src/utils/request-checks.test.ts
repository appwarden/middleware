import { describe, expect, it } from "vitest"
import { isHTMLRequest, isHTMLResponse } from "./request-checks"

describe("isHTMLResponse", () => {
  it("should return true for responses with text/html Content-Type", () => {
    const response = new Response("<html></html>", {
      headers: { "Content-Type": "text/html" },
    })
    expect(isHTMLResponse(response)).toBe(true)
  })

  it("should return true for responses with text/html; charset=utf-8", () => {
    const response = new Response("<html></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
    expect(isHTMLResponse(response)).toBe(true)
  })

  it("should return false for responses with application/json Content-Type", () => {
    const response = new Response(JSON.stringify({ data: "test" }), {
      headers: { "Content-Type": "application/json" },
    })
    expect(isHTMLResponse(response)).toBe(false)
  })

  it("should return false for responses with no Content-Type header", () => {
    const response = new Response("test")
    expect(isHTMLResponse(response)).toBe(false)
  })
})

describe("isHTMLRequest", () => {
  describe("should return true for requests with text/html in Accept header", () => {
    it.each([
      "text/html",
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "text/html, application/xhtml+xml",
      "application/json, text/html",
    ])("Accept: %s", (accept) => {
      const request = new Request("https://example.com", {
        headers: { accept },
      })
      expect(isHTMLRequest(request)).toBe(true)
    })
  })

  describe("should return false for requests with no Accept header", () => {
    it("no Accept header", () => {
      const request = new Request("https://example.com")
      expect(isHTMLRequest(request)).toBe(false)
    })
  })

  describe("should return false for wildcard-only Accept headers", () => {
    it.each([
      "*/*",
      "*",
      "*/*, */*",
      "*/*;q=0.8",
      "*;q=0.8",
      "*/*;q=0.8, */*;q=0.9",
      "  */*  ",
      "*/* ; q=0.8",
      "*, */*",
    ])("Accept: %s", (accept) => {
      const request = new Request("https://example.com", {
        headers: { accept },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })
  })

  describe("should return false for non-HTML Accept headers", () => {
    it.each([
      "application/json",
      "image/png",
      "image/webp,image/apng,image/*,*/*;q=0.8",
      "application/xml",
      "text/plain",
    ])("Accept: %s", (accept) => {
      const request = new Request("https://example.com", {
        headers: { accept },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })
  })

  describe("case-insensitive media type handling", () => {
    it.each([
      "Text/Html",
      "TEXT/HTML",
      "text/HTML",
      "TeXt/HtMl",
      "text/html, application/xhtml+xml",
      "TEXT/HTML,APPLICATION/XHTML+XML",
    ])("should return true for case variations: %s", (accept) => {
      const request = new Request("https://example.com", {
        headers: { accept },
      })
      expect(isHTMLRequest(request)).toBe(true)
    })

    it.each(["*/*", "*/*, */*", "*/*;Q=0.8"])(
      "should handle wildcard case variations: %s",
      (accept) => {
        const request = new Request("https://example.com", {
          headers: { accept },
        })
        expect(isHTMLRequest(request)).toBe(false)
      },
    )
  })

  describe("edge cases", () => {
    it("should handle empty Accept header", () => {
      const request = new Request("https://example.com", {
        headers: { accept: "" },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should handle Accept header with only whitespace", () => {
      const request = new Request("https://example.com", {
        headers: { accept: "   " },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should handle Accept header with only commas", () => {
      const request = new Request("https://example.com", {
        headers: { accept: ",,," },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should return true when text/html is mixed with wildcards", () => {
      const request = new Request("https://example.com", {
        headers: { accept: "text/html, */*;q=0.8" },
      })
      expect(isHTMLRequest(request)).toBe(true)
    })

    it("should return false for favicon.ico typical Accept header", () => {
      // Browsers typically send this for favicon.ico
      const request = new Request("https://example.com/favicon.ico", {
        headers: { accept: "*/*" },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should return false for image requests with wildcard fallback", () => {
      // Browsers send this for images
      const request = new Request("https://example.com/image.png", {
        headers: { accept: "image/webp,image/apng,image/*,*/*;q=0.8" },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should return true for typical browser navigation Accept header", () => {
      // Browsers send this for page navigation
      const request = new Request("https://example.com", {
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })
      expect(isHTMLRequest(request)).toBe(true)
    })

    it("should return false for substring false positives like application/text/html", () => {
      // This should NOT match because text/html is not a standalone media type
      const request = new Request("https://example.com", {
        headers: { accept: "application/text/html" },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should return false for substring false positives like text/htmlx", () => {
      // This should NOT match because text/htmlx is not text/html
      const request = new Request("https://example.com", {
        headers: { accept: "text/htmlx" },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should return false for substring false positives like xtext/html", () => {
      // This should NOT match because xtext/html is not text/html
      const request = new Request("https://example.com", {
        headers: { accept: "xtext/html" },
      })
      expect(isHTMLRequest(request)).toBe(false)
    })

    it("should return true for text/html with quality parameter", () => {
      const request = new Request("https://example.com", {
        headers: { accept: "text/html;q=0.9" },
      })
      expect(isHTMLRequest(request)).toBe(true)
    })

    it("should return true for text/html with charset parameter", () => {
      const request = new Request("https://example.com", {
        headers: { accept: "text/html; charset=utf-8" },
      })
      expect(isHTMLRequest(request)).toBe(true)
    })
  })
})

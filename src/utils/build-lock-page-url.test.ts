import { describe, expect, it } from "vitest"
import { buildLockPageUrl } from "./build-lock-page-url"

describe("buildLockPageUrl", () => {
  describe("slug normalization", () => {
    it("should add leading slash when slug does not start with /", () => {
      const url = buildLockPageUrl("locked", "https://example.com/dashboard")
      expect(url.pathname).toBe("/locked")
    })

    it("should preserve leading slash when slug already starts with /", () => {
      const url = buildLockPageUrl("/locked", "https://example.com/dashboard")
      expect(url.pathname).toBe("/locked")
    })

    it("should handle nested paths without leading slash", () => {
      const url = buildLockPageUrl(
        "maintenance/page",
        "https://example.com/api",
      )
      expect(url.pathname).toBe("/maintenance/page")
    })

    it("should handle nested paths with leading slash", () => {
      const url = buildLockPageUrl(
        "/maintenance/page",
        "https://example.com/api",
      )
      expect(url.pathname).toBe("/maintenance/page")
    })
  })

  describe("URL construction", () => {
    it("should use the origin from the request URL", () => {
      const url = buildLockPageUrl("locked", "https://example.com/dashboard")
      expect(url.origin).toBe("https://example.com")
    })

    it("should work with different origins", () => {
      const url = buildLockPageUrl(
        "locked",
        "https://app.mysite.io:8080/some/path",
      )
      expect(url.href).toBe("https://app.mysite.io:8080/locked")
    })

    it("should accept a URL object as requestUrl", () => {
      const requestUrl = new URL("https://example.com/dashboard")
      const url = buildLockPageUrl("locked", requestUrl)
      expect(url.href).toBe("https://example.com/locked")
    })

    it("should discard the original path from request URL", () => {
      const url = buildLockPageUrl(
        "locked",
        "https://example.com/deep/nested/path",
      )
      expect(url.pathname).toBe("/locked")
    })

    it("should discard query parameters from request URL", () => {
      const url = buildLockPageUrl(
        "locked",
        "https://example.com/page?foo=bar&baz=qux",
      )
      expect(url.search).toBe("")
      expect(url.href).toBe("https://example.com/locked")
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  buildLockPageUrl,
  isOnLockPage,
  normalizeLockPageSlug,
} from "./build-lock-page-url"

describe("normalizeLockPageSlug", () => {
  it("should add leading slash when slug does not start with /", () => {
    expect(normalizeLockPageSlug("locked")).toBe("/locked")
  })

  it("should preserve leading slash when slug already starts with /", () => {
    expect(normalizeLockPageSlug("/locked")).toBe("/locked")
  })

  it("should handle nested paths without leading slash", () => {
    expect(normalizeLockPageSlug("maintenance/page")).toBe("/maintenance/page")
  })

  it("should handle nested paths with leading slash", () => {
    expect(normalizeLockPageSlug("/maintenance/page")).toBe("/maintenance/page")
  })
})

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

describe("isOnLockPage", () => {
  describe("matching paths", () => {
    it("should return true when pathname exactly matches slug without leading slash", () => {
      expect(isOnLockPage("locked", "https://example.com/locked")).toBe(true)
    })

    it("should return true when pathname exactly matches slug with leading slash", () => {
      expect(isOnLockPage("/locked", "https://example.com/locked")).toBe(true)
    })

    it("should return true for nested paths", () => {
      expect(
        isOnLockPage(
          "maintenance/page",
          "https://example.com/maintenance/page",
        ),
      ).toBe(true)
    })

    it("should return true when URL has query parameters", () => {
      expect(
        isOnLockPage("maintenance", "https://example.com/maintenance?foo=bar"),
      ).toBe(true)
    })

    it("should return true when URL has hash fragment", () => {
      expect(
        isOnLockPage("maintenance", "https://example.com/maintenance#section"),
      ).toBe(true)
    })

    it("should accept a URL object as requestUrl", () => {
      const requestUrl = new URL("https://example.com/maintenance")
      expect(isOnLockPage("maintenance", requestUrl)).toBe(true)
    })
  })

  describe("non-matching paths", () => {
    it("should return false when pathname does not match slug", () => {
      expect(isOnLockPage("locked", "https://example.com/dashboard")).toBe(
        false,
      )
    })

    it("should return false when pathname is a subpath of slug", () => {
      expect(isOnLockPage("locked", "https://example.com/locked/extra")).toBe(
        false,
      )
    })

    it("should return false when pathname is a prefix of slug", () => {
      expect(isOnLockPage("locked-page", "https://example.com/locked")).toBe(
        false,
      )
    })

    it("should return false for root path when slug is not root", () => {
      expect(isOnLockPage("locked", "https://example.com/")).toBe(false)
    })

    it("should return false when paths are similar but not exact", () => {
      expect(isOnLockPage("maintenance", "https://example.com/maintain")).toBe(
        false,
      )
    })
  })
})

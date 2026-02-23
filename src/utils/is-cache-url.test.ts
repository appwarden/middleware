import { describe, expect, it } from "vitest"
import { getEdgeConfigId, isCacheUrl, isValidCacheUrl } from "./is-cache-url"

describe("isCacheUrl", () => {
  describe("edgeConfig", () => {
    it.each([
      "https://edge-config.vercel.com/ecfg_123?token=abc",
      "http://edge-config.vercel.com/something",
    ])(
      "should return true for URL containing edge-config.vercel.com: %s",
      (url) => {
        expect(isCacheUrl.edgeConfig(url)).toBe(true)
      },
    )

    // This test is separate because it's not a valid URL (missing protocol)
    // but the implementation has a fallback for this case
    it("should handle URL-like string with edge-config.vercel.com", () => {
      expect(isCacheUrl.edgeConfig("edge-config.vercel.com/path")).toBe(false)
    })

    it.each([
      "https://vercel.com",
      "https://example.com/edge-config",
      "",
      undefined,
    ])(
      "should return false for URL not containing edge-config.vercel.com: %s",
      (url) => {
        expect(isCacheUrl.edgeConfig(url)).toBe(false)
      },
    )

    it("should handle undefined input", () => {
      expect(isCacheUrl.edgeConfig(undefined)).toBe(false)
    })
  })

  describe("upstash", () => {
    it.each([
      "rediss://:password@funky-roughy-44527.upstash.io:6379",
      "https://something.upstash.io/path",
      "funky-roughy.upstash.io",
    ])("should return true for URL containing .upstash.io: %s", (url) => {
      expect(isCacheUrl.upstash(url)).toBe(true)
    })

    it.each([
      "https://vercel.com",
      "https://example.com/upstash",
      "",
      undefined,
    ])("should return false for URL not containing .upstash.io: %s", (url) => {
      expect(isCacheUrl.upstash(url)).toBe(false)
    })

    it("should handle undefined input", () => {
      expect(isCacheUrl.upstash(undefined)).toBe(false)
    })
  })
})

describe("isValidCacheUrl", () => {
  describe("edgeConfig", () => {
    it.each([
      "https://edge-config.vercel.com/ecfg_123?token=abc",
      "https://edge-config.vercel.com/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz?token=5010d9a6-04e1-4219-a8b7-f8ecfd3e10d6",
    ])("should return true for valid Edge Config URL: %s", (url) => {
      expect(isValidCacheUrl.edgeConfig(url)).toBe(true)
    })

    it.each([
      // Missing token
      "https://edge-config.vercel.com/ecfg_123",
      // Wrong hostname
      "https://config.vercel.com/ecfg_123?token=abc",
      // Wrong path format
      "https://edge-config.vercel.com/config_123?token=abc",
      // Not a URL
      "edge-config",
      // Empty string
      "",
      // Undefined
      undefined,
    ])("should return false for invalid Edge Config URL: %s", (url) => {
      expect(isValidCacheUrl.edgeConfig(url)).toBe(false)
    })

    it.each([
      "http://",
      "://edge-config.vercel.com",
      "edge-config.vercel.com/ecfg_123?token=abc", // Missing protocol
    ])("should handle malformed URL: %s", (url) => {
      expect(isValidCacheUrl.edgeConfig(url)).toBe(false)
    })
  })

  describe("upstash", () => {
    it.each([
      {
        url: "redis://:password@funky-roughy-44527.upstash.io:6379",
        expectedPassword: "password",
      },
      {
        url: "rediss://:Aa3vAAIjcDFkNWIzYTlkODVhMWY0ZjliOGQzMmUyNmMxZWUxMzcxOXAxMA@funky-roughy-44527.upstash.io:6379",
        expectedPassword:
          "Aa3vAAIjcDFkNWIzYTlkODVhMWY0ZjliOGQzMmUyNmMxZWUxMzcxOXAxMA",
      },
    ])(
      "should return the password for valid Upstash URL",
      ({ url, expectedPassword }) => {
        const result = isValidCacheUrl.upstash(url)
        expect(result).toBe(expectedPassword)
      },
    )

    it.each([
      // Wrong protocol
      "https://funky-roughy-44527.upstash.io:6379",
      // Wrong hostname
      "redis://:password@funky-roughy-44527.example.com:6379",
      // Not a URL
      "upstash",
    ])("should return false for invalid Upstash URL: %s", (url) => {
      const result = isValidCacheUrl.upstash(url)
      expect(result).toBe(false)
    })

    // This test is separate because the implementation returns an empty string
    // for this case, which is falsy but not strictly false
    it("should handle URL with missing password", () => {
      const result = isValidCacheUrl.upstash(
        "redis://funky-roughy-44527.upstash.io:6379",
      )
      expect(result).toBe("")
    })

    it("should handle empty strings and undefined", () => {
      expect(isValidCacheUrl.upstash("")).toBe(false)
      expect(isValidCacheUrl.upstash(undefined)).toBe(false)
    })

    it.each([
      "redis://",
      "://funky-roughy-44527.upstash.io:6379",
      "funky-roughy-44527.upstash.io:6379", // Missing protocol
    ])("should handle malformed URL: %s", (url) => {
      expect(isValidCacheUrl.upstash(url)).toBe(false)
    })
  })
})

describe("getEdgeConfigId", () => {
  it("should extract the Edge Config ID from a valid URL", () => {
    const url =
      "https://edge-config.vercel.com/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz?token=5010d9a6-04e1-4219-a8b7-f8ecfd3e10d6"
    expect(getEdgeConfigId(url)).toBe("ecfg_yaa9pmoquhmf29cnfott3jhbsfdz")
  })

  it.each([
    "https://edge-config.vercel.com/config_123?token=abc", // Wrong path format
    "https://config.vercel.com/ecfg_123?token=abc", // Wrong hostname
    "https://edge-config.vercel.com/ecfg_123", // Missing token
    "edge-config",
    "",
    undefined,
  ])("should return undefined for invalid Edge Config URL: %s", (url) => {
    expect(getEdgeConfigId(url)).toBeUndefined()
  })

  it.each([
    "http://",
    "://edge-config.vercel.com",
    "edge-config.vercel.com/ecfg_123?token=abc", // Missing protocol
  ])("should handle malformed URL: %s", (url) => {
    expect(getEdgeConfigId(url)).toBeUndefined()
  })
})

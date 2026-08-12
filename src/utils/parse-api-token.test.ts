import { describe, expect, it } from "vitest"
import { API_TOKEN_CONFIG, parseApiToken } from "./parse-api-token"

const VALID_TOKEN =
  "aw_1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"
const VALID_PUBLIC_ID = "1234567890123456789012"
const VALID_SECRET = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"

describe("parseApiToken", () => {
  it("should parse a valid dual-token", () => {
    const result = parseApiToken(VALID_TOKEN)

    expect(result).toEqual({
      publicId: VALID_PUBLIC_ID,
      secret: VALID_SECRET,
    })
  })

  it("should trim surrounding whitespace before parsing", () => {
    expect(parseApiToken(`  ${VALID_TOKEN}\n`)).toEqual({
      publicId: VALID_PUBLIC_ID,
      secret: VALID_SECRET,
    })
  })

  it("should return undefined for a legacy base64 token", () => {
    expect(parseApiToken("dGVzdC1zZWNyZXQ6b3JnSWQ=")).toBeUndefined()
  })

  it("should return undefined when the prefix is missing", () => {
    expect(
      parseApiToken(
        "1234567890123456789012_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR",
      ),
    ).toBeUndefined()
  })

  it("should return undefined when the separator is missing", () => {
    expect(
      parseApiToken(`aw_${VALID_PUBLIC_ID}${VALID_SECRET}`),
    ).toBeUndefined()
  })

  it("should return undefined when the publicId is the wrong length", () => {
    expect(
      parseApiToken(`aw_${VALID_PUBLIC_ID.slice(0, -1)}_${VALID_SECRET}`),
    ).toBeUndefined()
  })

  it("should return undefined when the publicId contains non-alphanumeric characters", () => {
    expect(
      parseApiToken(`aw_${VALID_PUBLIC_ID.slice(0, -1)}!_${VALID_SECRET}`),
    ).toBeUndefined()
  })

  it("should return undefined when the secret is the wrong length", () => {
    expect(
      parseApiToken(`aw_${VALID_PUBLIC_ID}_${VALID_SECRET.slice(0, -1)}`),
    ).toBeUndefined()
  })

  it("should return undefined for an empty string", () => {
    expect(parseApiToken("")).toBeUndefined()
  })

  it("should return undefined for whitespace-only input", () => {
    expect(parseApiToken("   ")).toBeUndefined()
  })

  it("should match the documented token format constants", () => {
    expect(API_TOKEN_CONFIG.PREFIX).toBe("aw_")
    expect(API_TOKEN_CONFIG.SEPARATOR).toBe("_")
    expect(API_TOKEN_CONFIG.PUBLIC_ID_LENGTH).toBe(22)
    expect(API_TOKEN_CONFIG.SECRET_LENGTH).toBe(43)
  })
})

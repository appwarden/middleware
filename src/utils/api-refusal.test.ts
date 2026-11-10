import { describe, expect, it } from "vitest"
import { classifyApiRefusal, readRefusalCode } from "./api-refusal"
import { apiRefusalCases } from "./api-refusal.cases"

describe("classifyApiRefusal", () => {
  it.each(apiRefusalCases)(
    "classifies HTTP $status with code $code as $kind",
    ({ status, code, kind, message }) => {
      expect(classifyApiRefusal(status, code)).toEqual({ kind, message })
    },
  )

  it("treats an unknown code on a 401 as a bad token, not an expired one", () => {
    expect(classifyApiRefusal(401, "SOMETHING_ELSE").message).toContain(
      "Ensure your Appwarden API token is correct",
    )
  })

  it("treats a 402 without the subscription code as a generic refusal", () => {
    expect(classifyApiRefusal(402)).toEqual({
      kind: "fatal",
      message: "The Appwarden API refused the request (HTTP 402).",
    })
  })
})

describe("readRefusalCode", () => {
  it("reads the API's error.code", async () => {
    const response = new Response(
      JSON.stringify({ error: { code: "INSUFFICIENT_SCOPE" } }),
      { status: 403 },
    )

    await expect(readRefusalCode(response)).resolves.toBe("INSUFFICIENT_SCOPE")
  })

  it("returns undefined when the body is not JSON", async () => {
    const response = new Response("<html>502</html>", { status: 502 })

    await expect(readRefusalCode(response)).resolves.toBeUndefined()
  })

  it("returns undefined when the body has no code", async () => {
    const response = new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    })

    await expect(readRefusalCode(response)).resolves.toBeUndefined()
  })
})

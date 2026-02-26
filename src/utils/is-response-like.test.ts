import { describe, expect, it } from "vitest"
import { isResponseLike } from "./is-response-like"

describe("isResponseLike", () => {
  describe("valid response-like values", () => {
    it("returns true for a real Response instance", () => {
      const response = new Response("ok", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })

      expect(isResponseLike(response)).toBe(true)
    })

    it("returns true for an object with headers.has, headers.set, headers.get and body", () => {
      const headers = {
        has: () => true,
        set: () => {},
        get: () => "text/html",
      }

      const responseLike = { headers, body: "body" }

      expect(isResponseLike(responseLike)).toBe(true)
    })
  })

  describe("invalid values", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["string", "foo"],
      ["number", 123],
      ["boolean true", true],
      ["boolean false", false],
    ])("returns false for non-object value: %s", (_, value) => {
      // Cast to unknown to match the utility's input type
      expect(isResponseLike(value as unknown)).toBe(false)
    })

    it.each([
      ["plain object without headers", {}],
      ["headers is null", { headers: null }],
      ["headers is not an object", { headers: "not-an-object" }],
      [
        "headers missing has",
        { headers: { set: () => {}, get: () => "" }, body: "body" },
      ],
      [
        "headers missing set",
        { headers: { has: () => true, get: () => "" }, body: "body" },
      ],
      [
        "headers missing get",
        { headers: { has: () => true, set: () => {} }, body: "body" },
      ],
      [
        "headers.has is not a function",
        { headers: { has: "yes", set: () => {}, get: () => "" }, body: "body" },
      ],
      [
        "headers.set is not a function",
        {
          headers: { has: () => true, set: "not-a-function", get: () => "" },
          body: "body",
        },
      ],
      [
        "headers.get is not a function",
        {
          headers: { has: () => true, set: () => {}, get: "not-a-function" },
          body: "body",
        },
      ],
      [
        "missing body property",
        { headers: { has: () => true, set: () => {}, get: () => "" } },
      ],
      ["array value", []],
    ])("returns false for invalid response-like object: %s", (_, value) => {
      expect(isResponseLike(value as unknown)).toBe(false)
    })
  })
})

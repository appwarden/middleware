import { describe, expect, it } from "vitest"
import { UseCSPInputSchema } from "./use-content-security-policy"

describe("UseCSPInputSchema", () => {
  it.each(["disabled", "report-only", "enforced"])(
    "works with known modes",
    (mode) => {
      expect(UseCSPInputSchema.parse({ mode, directives: "{}" })).toEqual({
        mode,
        directives: {},
      })
    },
  )
  it("defaults to disabled", () => {
    expect(UseCSPInputSchema.parse({ mode: undefined })).toEqual({
      mode: "disabled",
    })
  })
})

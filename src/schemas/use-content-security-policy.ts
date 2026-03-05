import { z } from "zod"
import {
  ContentSecurityPolicySchema,
  ContentSecurityPolicyType,
} from "../types"
import { SchemaErrorKey } from "../utils"

export const CSPDirectivesSchema = z.union([
  z.string(),
  ContentSecurityPolicySchema,
])

export const CSPModeSchema = z.union([
  z.literal("disabled"),
  z.literal("report-only"),
  z.literal("enforced"),
])

export const UseCSPInputSchema = z.object({
  mode: CSPModeSchema,
  directives: CSPDirectivesSchema.refine(
    (val) => {
      // validate if the value is a string, that it can be parsed as JSON
      try {
        if (typeof val === "string") {
          JSON.parse(val)
        }
        return true
      } catch (error) {
        return false
      }
    },
    { message: SchemaErrorKey.DirectivesBadParse },
  ).transform(
    (val) =>
      (typeof val === "string" ? JSON.parse(val) : val) as
        | ContentSecurityPolicyType
        | undefined,
  ),
})

export type UseCSPInput = z.infer<typeof UseCSPInputSchema>

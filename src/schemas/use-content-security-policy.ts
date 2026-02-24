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

export const CSPModeSchema = z
  .union([
    z.literal("disabled"),
    z.literal("report-only"),
    z.literal("enforced"),
  ])
  .optional()
  .default("disabled")

export const UseCSPInputSchema = z
  .object({
    mode: CSPModeSchema,
    directives: CSPDirectivesSchema.optional()
      .refine(
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
      )
      .transform(
        (val) =>
          (typeof val === "string" ? JSON.parse(val) : val) as
            | ContentSecurityPolicyType
            | undefined,
      ),
  })
  .refine(
    (values) =>
      // validate that directives are provided when the mode is "report-only" or "enforced"
      ["report-only", "enforced"].includes(values.mode)
        ? !!values.directives
        : true,
    { path: ["directives"], message: SchemaErrorKey.DirectivesRequired },
  )

export type UseCSPInput = z.infer<typeof UseCSPInputSchema>

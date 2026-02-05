import { z } from "zod"
import { Middleware, RequestContext } from "../types"
import {
  lockPageSlugRefinement,
  UseAppwardenInputSchema,
} from "./use-appwarden"

export const ConfigFnInputSchema = z
  .function()
  .args(z.custom<RequestContext>())
  .returns(
    lockPageSlugRefinement(
      UseAppwardenInputSchema.extend({
        middleware: z
          .object({
            before: z.custom<Middleware>().array().default([]),
            after: z.custom<Middleware>().array().default([]),
          })
          .default({}),
      }),
    ),
  )

// Define the return type explicitly since ZodEffects (from .refine())
// loses type inference when used with ReturnType<z.infer<...>>
export type CloudflareConfigType = z.infer<typeof UseAppwardenInputSchema> & {
  middleware: {
    before: Middleware[]
    after: Middleware[]
  }
}

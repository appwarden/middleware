import { z } from "zod"
import { Middleware, RequestContext } from "../types"
import { UseAppwardenInputSchema } from "./use-appwarden"

export const ConfigFnInputSchema = z
  .function()
  .args(z.custom<RequestContext>())
  .returns(
    UseAppwardenInputSchema.extend({
      middleware: z
        .object({ before: z.custom<Middleware>().array().default([]) })
        .default({}),
    }),
  )

export type CloudflareConfigType = ReturnType<
  z.infer<typeof ConfigFnInputSchema>
>

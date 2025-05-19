import { z } from "zod"
import { RequestContext } from "../types"
import { UseAppwardenInputSchema } from "./use-appwarden"

export const NextJsConfigFnOutputSchema = z
  .function()
  .args(z.custom<RequestContext>())
  .returns(UseAppwardenInputSchema)

export type NextJsConfigFnType = z.infer<typeof NextJsConfigFnOutputSchema>

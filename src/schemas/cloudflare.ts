import { z } from "zod"
import { RequestContext } from "../types"
import {
  lockPageSlugRefinement,
  UseAppwardenInputSchema,
} from "./use-appwarden"

export const ConfigFnInputSchema = z
  .function()
  .args(z.custom<RequestContext>())
  .returns(z.lazy(() => lockPageSlugRefinement(UseAppwardenInputSchema)))

// Define the return type explicitly since ZodEffects (from .refine())
// loses type inference when used with ReturnType<z.infer<...>>
export type CloudflareConfigType = z.infer<typeof UseAppwardenInputSchema>

import { z } from "zod"
import { RequestContext } from "../types"
import {
  appwardenConfigRefinement,
  UseAppwardenInputSchema,
} from "./use-appwarden"

export const ConfigFnInputSchema = z
  .function()
  .args(z.custom<RequestContext>())
  .returns(z.lazy(() => appwardenConfigRefinement(UseAppwardenInputSchema)))

export type CloudflareConfigType = z.infer<typeof UseAppwardenInputSchema>

export type CloudflareConfigFnType = z.input<typeof ConfigFnInputSchema>

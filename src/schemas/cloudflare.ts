import { z } from "zod"
import { RequestContext } from "../types"
import {
  appwardenConfigRefinement,
  UseAppwardenInputSchema,
} from "./use-appwarden"

/**
 * Runtime guard for the exported Cloudflare config function.
 *
 * Zod 4 validates the function's arguments and return value through
 * `z.function({ input, output })`. Note that a failing output validation throws
 * Zod's internal `$ZodError`, which is not an instance of the classic
 * `ZodError`; `appwardenOnCloudflare` normalises it before the error reaches
 * the logging/heartbeat paths.
 */
export const ConfigFnInputSchema = z.function({
  input: [z.custom<RequestContext>()],
  output: z.lazy(() => appwardenConfigRefinement(UseAppwardenInputSchema)),
})

export type CloudflareConfigType = z.infer<typeof UseAppwardenInputSchema>

export type CloudflareConfigFnType = z.input<typeof ConfigFnInputSchema>

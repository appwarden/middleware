import { z } from "zod"
import { BooleanSchema } from "./helpers"

export const UseAppwardenInputSchema = z.object({
  debug: BooleanSchema.default(false),
  lockPageSlug: z.string(),
  appwardenApiToken: z
    .string()
    .refine((val) => !!val, { path: ["appwardenApiToken"] }),
})

import { z } from "zod"

export const BoolOrStringSchema = z.union([z.string(), z.boolean()]).optional()

export const BooleanSchema = BoolOrStringSchema.transform((val) => {
  if (val === "true" || val === true) {
    return true
  } else if (val === "false" || val === false) {
    return false
  }
  throw new Error("Invalid value")
})

/** Schema for the Appwarden API token - validates it's a non-empty string */
export const AppwardenApiTokenSchema = z
  .string()
  .refine((val) => !!val, { message: "appwardenApiToken is required" })

export const LockValue = z.object({
  isLocked: z.number(),
  isLockedTest: z.number(),
  lastCheck: z.number(),
  code: z.string(),
})

export type LockValueType = z.infer<typeof LockValue>

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

export const LockValue = z.object({
  isLocked: z.number(),
  isLockedTest: z.number(),
  lastCheck: z.number(),
  code: z.string(),
})

export type LockValueType = z.infer<typeof LockValue>

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

/** Schema for the Appwarden API hostname - validates it's an absolute HTTPS URL */
export const AppwardenApiHostnameSchema = z
  .string()
  .url({
    message:
      "Invalid `appwardenApiHostname`. Please provide an absolute URL (e.g. https://api.appwarden.io).",
  })
  .refine((value) => value.startsWith("https://"), {
    message:
      "`appwardenApiHostname` must use the https:// scheme (e.g. https://api.appwarden.io).",
  })

export const LockValue = z.object({
  isLocked: z.number(),
  isLockedTest: z.number(),
  lastCheck: z.number(),
})

export type LockValueType = z.infer<typeof LockValue>

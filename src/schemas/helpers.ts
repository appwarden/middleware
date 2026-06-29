import { z } from "zod"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"

export const BoolOrStringSchema = z.union([z.string(), z.boolean()]).optional()

export const BooleanSchema = BoolOrStringSchema.refine(
  (val) => val === "true" || val === true || val === "false" || val === false,
  {
    message:
      AppwardenConfigErrorMessages[AppwardenConfigErrorKey.BooleanInvalid],
    params: {
      appwardenErrorKey: AppwardenConfigErrorKey.BooleanInvalid,
    },
  },
).transform((val) => {
  if (val === "true" || val === true) {
    return true
  }
  return false
})

/** Schema for the Appwarden API token - validates it's a non-empty string */
export const AppwardenApiTokenSchema = z
  .preprocess(
    (val) => (val === undefined || val === null ? "" : val),
    z.string(),
  )
  .refine((val) => val.trim().length > 0, {
    message:
      AppwardenConfigErrorMessages[
        AppwardenConfigErrorKey.AppwardenApiTokenMissing
      ],
    params: {
      appwardenErrorKey: AppwardenConfigErrorKey.AppwardenApiTokenMissing,
    },
  })

/** Schema for the Appwarden API hostname - validates it's an absolute HTTPS URL */
export const AppwardenApiHostnameSchema = z
  .string()
  .refine(
    (value) => {
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    },
    {
      message:
        AppwardenConfigErrorMessages[
          AppwardenConfigErrorKey.AppwardenApiHostnameInvalidUrl
        ],
      params: {
        appwardenErrorKey:
          AppwardenConfigErrorKey.AppwardenApiHostnameInvalidUrl,
      },
    },
  )
  .refine((value) => value.startsWith("https://"), {
    message:
      AppwardenConfigErrorMessages[
        AppwardenConfigErrorKey.AppwardenApiHostnameMustUseHttps
      ],
    params: {
      appwardenErrorKey:
        AppwardenConfigErrorKey.AppwardenApiHostnameMustUseHttps,
    },
  })
  .refine(
    (value) => {
      try {
        const hostname = new URL(value).hostname
        return (
          hostname === "api.appwarden.io" ||
          hostname === "staging-api.appwarden.io"
        )
      } catch {
        return false
      }
    },
    {
      message:
        AppwardenConfigErrorMessages[
          AppwardenConfigErrorKey.AppwardenApiHostnameMustBeAppwarden
        ],
      params: {
        appwardenErrorKey:
          AppwardenConfigErrorKey.AppwardenApiHostnameMustBeAppwarden,
      },
    },
  )

export const LockValue = z.object({
  isLocked: z.number(),
  isLockedTest: z.number(),
  lastCheck: z.number(),
})

export type LockValueType = z.infer<typeof LockValue>

export const ValidLockPageSlugSchema = z
  .string()
  .refine(
    (val) =>
      !val.includes("://") && !val.startsWith("//") && !val.includes("\\"),
    {
      message:
        AppwardenConfigErrorMessages[
          AppwardenConfigErrorKey.LockPageSlugMustBeRelativePath
        ],
      params: {
        appwardenErrorKey:
          AppwardenConfigErrorKey.LockPageSlugMustBeRelativePath,
      },
    },
  )

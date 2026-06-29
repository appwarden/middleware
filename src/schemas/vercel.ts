import { z } from "zod"
import { ContentSecurityPolicyType } from "../types"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
  isCacheUrl,
  isValidCacheUrl,
} from "../utils"
import {
  AppwardenApiHostnameSchema,
  AppwardenApiTokenSchema,
  ValidLockPageSlugSchema,
} from "./helpers"
import {
  CSPDirectivesSchema,
  CSPModeSchema,
} from "./use-content-security-policy"

export const VercelCSPSchema = z.object({
  mode: CSPModeSchema,
  directives: z
    .lazy(() => CSPDirectivesSchema)
    .refine(
      (val) => {
        try {
          if (typeof val === "string") {
            JSON.parse(val)
          }
          return true
        } catch {
          return false
        }
      },
      {
        message:
          AppwardenConfigErrorMessages[
            AppwardenConfigErrorKey.CspDirectivesBadParse
          ],
        params: {
          appwardenErrorKey: AppwardenConfigErrorKey.CspDirectivesBadParse,
        },
      },
    )
    .refine(
      (val) => {
        const serialized = typeof val === "string" ? val : JSON.stringify(val)
        return !serialized.includes("{{nonce}}")
      },
      {
        message:
          AppwardenConfigErrorMessages[
            AppwardenConfigErrorKey.VercelNonceUnsupported
          ],
        params: {
          appwardenErrorKey: AppwardenConfigErrorKey.VercelNonceUnsupported,
        },
      },
    )
    .transform(
      (val) =>
        (typeof val === "string" ? JSON.parse(val) : val) as
          | ContentSecurityPolicyType
          | undefined,
    ),
})

export const BaseNextJsConfigSchema = z.object({
  cacheUrl: z.string(),
  appwardenApiToken: AppwardenApiTokenSchema,
  appwardenApiHostname: AppwardenApiHostnameSchema.optional(),
  vercelApiToken: z.string().optional(),
  debug: z.boolean().optional(),
  lockPageSlug: ValidLockPageSlugSchema.default("").transform((val) =>
    val.replace(/^\/?/, "/"),
  ),
  contentSecurityPolicy: VercelCSPSchema.optional(),
})

export const AppwardenConfigSchema = BaseNextJsConfigSchema
  // First check if the URL is recognized as either Edge Config or Upstash
  .refine(
    (data) => {
      return (
        isCacheUrl.edgeConfig(data.cacheUrl) ||
        isCacheUrl.upstash(data.cacheUrl)
      )
    },
    {
      message:
        AppwardenConfigErrorMessages[
          AppwardenConfigErrorKey.CacheUrlUnrecognized
        ],
      params: {
        appwardenErrorKey: AppwardenConfigErrorKey.CacheUrlUnrecognized,
      },
      path: ["cacheUrl"],
    },
  )
  .superRefine((data, ctx) => {
    // If it looks like an Edge Config URL (by hostname), validate its strict format
    if (
      isCacheUrl.edgeConfig(data.cacheUrl) &&
      !isValidCacheUrl.edgeConfig(data.cacheUrl)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          AppwardenConfigErrorMessages[
            AppwardenConfigErrorKey.CacheUrlInvalidEdgeConfig
          ],
        params: {
          appwardenErrorKey: AppwardenConfigErrorKey.CacheUrlInvalidEdgeConfig,
        },
        path: ["cacheUrl"],
      })
      return false
    }

    // If it looks like an Upstash URL (by hostname), validate its strict format
    if (
      isCacheUrl.upstash(data.cacheUrl) &&
      !isValidCacheUrl.upstash(data.cacheUrl)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          AppwardenConfigErrorMessages[
            AppwardenConfigErrorKey.CacheUrlInvalidUpstash
          ],
        params: {
          appwardenErrorKey: AppwardenConfigErrorKey.CacheUrlInvalidUpstash,
        },
        path: ["cacheUrl"],
      })
      return false
    }

    return true
  })
  // Require vercelApiToken when using Edge Config
  .refine(
    (data) =>
      isCacheUrl.edgeConfig(data.cacheUrl) ? !!data.vercelApiToken : true,
    {
      message:
        AppwardenConfigErrorMessages[
          AppwardenConfigErrorKey.VercelApiTokenRequired
        ],
      params: {
        appwardenErrorKey: AppwardenConfigErrorKey.VercelApiTokenRequired,
      },
      path: ["vercelApiToken"],
    },
  )

export type BaseNextJsConfigFnType = z.infer<typeof BaseNextJsConfigSchema>

export type VercelAppwardenConfig = z.input<typeof AppwardenConfigSchema>

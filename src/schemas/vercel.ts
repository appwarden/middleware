import { z } from "zod"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"
import { isCacheUrl, isValidCacheUrl } from "../utils/is-cache-url"
import {
  AppwardenMiddlewareConfigWithoutNonceSchema,
  MiddlewareOptionsWithoutNonceSchema,
} from "./middleware-options"

export const BaseNextJsConfigSchema =
  AppwardenMiddlewareConfigWithoutNonceSchema.extend({
    cacheUrl: z.string(),
    vercelApiToken: z.string().optional(),
    appwardenMiddleware: z
      .array(
        z.object({
          url: z.string(),
          options: MiddlewareOptionsWithoutNonceSchema,
        }),
      )
      .optional(),
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

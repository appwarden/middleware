import { z } from "zod"
import { isCacheUrl, isValidCacheUrl } from "../utils"
import { printMessage } from "../utils/print-message"

export const BaseNextJsConfigSchema = z.object({
  cacheUrl: z.string(),
  appwardenApiToken: z.string(),
  vercelApiToken: z.string().optional(),
  lockPageSlug: z
    .string()
    .default("")
    .transform((val) => val.replace(/^\/?/, "/")),
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
      message: printMessage(
        "Provided `cacheUrl` is not recognized. Please provide a Vercel Edge Config or Upstash KV url.",
      ),
      path: ["cacheUrl"],
    },
  )
  .superRefine((data, ctx) => {
    // If it's an Edge Config URL, validate its format
    if (
      !isValidCacheUrl.edgeConfig(data.cacheUrl) &&
      isValidCacheUrl.upstash(data.cacheUrl)
    ) {
      ctx.addIssue({
        code: "custom",
        message: printMessage(
          "Provided Vercel Edge Config `cacheUrl` is not valid. It should be in the format https://edge-config.vercel.com/ecfg_*",
        ),
        path: ["cacheUrl"],
      })
      return false
    }

    // If it's an Upstash URL, validate its format
    if (
      !isValidCacheUrl.upstash(data.cacheUrl) &&
      isValidCacheUrl.edgeConfig(data.cacheUrl)
    ) {
      ctx.addIssue({
        code: "custom",
        message: printMessage(
          "Provided Upstash KV `cacheUrl` is not valid. It should be in the format rediss://:password@hostname.upstash.io:6379",
        ),
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
      message: printMessage(
        "The `vercelApiToken` option is required when using Vercel Edge Config",
      ),
      path: ["vercelApiToken"],
    },
  )
  // Always require appwardenApiToken
  .refine((data) => !!data.appwardenApiToken, {
    message: printMessage(
      "Please provide a valid `appwardenApiToken`. Learn more at https://appwarden.com/docs/guides/api-token-management.",
    ),
    path: ["appwardenApiToken"],
  })

export type BaseNextJsConfigFnType = z.infer<typeof BaseNextJsConfigSchema>

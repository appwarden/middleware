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

export const AppwardenConfigSchema = BaseNextJsConfigSchema.refine(
  (data) =>
    isCacheUrl.edgeConfig(data.cacheUrl) || isCacheUrl.upstash(data.cacheUrl),
  {
    message: printMessage(
      "Provided `cacheUrl` is not recognized. Please provide a Vercel Edge Config or Upstash KV url.",
    ),
    path: ["cacheUrl"],
  },
)
  .refine(
    (data) =>
      isCacheUrl.edgeConfig(data.cacheUrl)
        ? isValidCacheUrl.edgeConfig(data.cacheUrl)
        : true,
    {
      message: printMessage(
        "Provided Vercel Edge Config `cacheUrl` is not valid. Please provide a valid Vercel Edge Config url.",
      ),
      path: ["cacheUrl"],
    },
  )
  .refine(
    (data) =>
      isCacheUrl.upstash(data.cacheUrl)
        ? isValidCacheUrl.upstash(data.cacheUrl)
        : true,
    {
      message: printMessage(
        "Provided Upstash KV `cacheUrl` is not valid. Please provide a valid Upstash KV url.",
      ),
      path: ["cacheUrl"],
    },
  )
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
  .refine((data) => !!data.appwardenApiToken, {
    message: printMessage(
      "Please provide a valid `appwardenApiToken`. Learn more at https://appwarden.com/docs/guides/api-token-management.",
    ),
    path: ["appwardenApiToken"],
  })

export type BaseNextJsConfigFnType = z.infer<typeof BaseNextJsConfigSchema>

import { z } from "zod"
import { ContentSecurityPolicyType } from "../types"
import { isCacheUrl, isValidCacheUrl, SchemaErrorKey } from "../utils"
import { printMessage } from "../utils/print-message"
import {
  CSPDirectivesSchema,
  CSPModeSchema,
} from "./use-content-security-policy"

export const VercelCSPSchema = z
  .object({
    mode: CSPModeSchema,
    directives: z
      .lazy(() => CSPDirectivesSchema)
      .optional()
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
        { message: SchemaErrorKey.DirectivesBadParse },
      )
      .refine(
        (val) => {
          if (!val) return true
          const serialized = typeof val === "string" ? val : JSON.stringify(val)
          return !serialized.includes("{{nonce}}")
        },
        {
          message:
            "Nonce-based CSP is not supported in Vercel Edge Middleware. Remove '{{nonce}}' placeholders from your CSP directives, as Vercel does not support nonce injection.",
        },
      )
      .transform(
        (val) =>
          (typeof val === "string" ? JSON.parse(val) : val) as
            | ContentSecurityPolicyType
            | undefined,
      ),
  })
  .refine(
    (values) =>
      ["report-only", "enforced"].includes(values.mode)
        ? !!values.directives
        : true,
    { path: ["directives"], message: SchemaErrorKey.DirectivesRequired },
  )

export const BaseNextJsConfigSchema = z.object({
  cacheUrl: z.string(),
  appwardenApiToken: z.string(),
  vercelApiToken: z.string().optional(),
  debug: z.boolean().optional(),
  lockPageSlug: z
    .string()
    .default("")
    .transform((val) => val.replace(/^\/?/, "/")),
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
      message: printMessage(
        "Provided `cacheUrl` is not recognized. Please provide a Vercel Edge Config or Upstash KV url.",
      ),
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
        message: printMessage(
          "Provided Vercel Edge Config `cacheUrl` is not valid. It should be in the format https://edge-config.vercel.com/ecfg_*",
        ),
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

export type VercelAppwardenConfig = z.input<typeof AppwardenConfigSchema>

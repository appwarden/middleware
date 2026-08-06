import { z } from "zod"
import { ContentSecurityPolicyType } from "../types"
import { BooleanSchema, ValidLockPageSlugSchema } from "./helpers"
import {
  CSPDirectivesSchema,
  CSPModeSchema,
} from "./use-content-security-policy"

export const ApiLockResponseSchema = z.object({
  status: z.number().int().min(100).max(599).optional(),
  body: z.string().optional(),
  headers: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
})

export type ApiLockResponse = z.infer<typeof ApiLockResponseSchema>

export const ApiMiddlewareConfigSchema = z.object({
  basePaths: z.array(z.string()),
  response: ApiLockResponseSchema.optional(),
})

export type ApiMiddlewareConfig = z.infer<typeof ApiMiddlewareConfigSchema>

export const WebsiteMiddlewareConfigSchema = z.object({
  lockPageSlug: ValidLockPageSlugSchema,
  cspMode: CSPModeSchema.optional(),
  cspDirectives: z
    .lazy(() => CSPDirectivesSchema)
    .superRefine((val, ctx) => {
      if (typeof val === "string") {
        try {
          JSON.parse(val)
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "cspDirectives must be a valid JSON string",
          })
        }
      }
    })
    .transform(
      (val) =>
        (typeof val === "string" ? JSON.parse(val) : val) as
          ContentSecurityPolicyType | undefined,
    )
    .optional(),
})

export type WebsiteMiddlewareConfig = z.infer<
  typeof WebsiteMiddlewareConfigSchema
>

export const MiddlewareOptionsSchema = z.object({
  debug: BooleanSchema.optional(),
  bypassPaths: z.array(z.string()).optional(),
  website: WebsiteMiddlewareConfigSchema.optional(),
  api: ApiMiddlewareConfigSchema.optional(),
})

export type MiddlewareOptions = z.infer<typeof MiddlewareOptionsSchema>

export const ServiceMiddlewareSchema = z.object({
  url: z.string(),
  options: MiddlewareOptionsSchema,
})

export type ServiceMiddleware = z.infer<typeof ServiceMiddlewareSchema>

export const AppwardenMiddlewareArraySchema = z.array(ServiceMiddlewareSchema)

export type AppwardenMiddlewareConfig = z.infer<typeof ServiceMiddlewareSchema>

/**
 * Resolved middleware configuration for a single request hostname.
 * This is the internal shape used by the middleware after looking up
 * the route-based config or synthesizing it from legacy fields.
 */
export interface ResolvedMiddlewareConfig {
  debug: boolean
  bypassPaths: string[] | undefined
  website: WebsiteMiddlewareConfig | undefined
  api: ApiMiddlewareConfig | undefined
}

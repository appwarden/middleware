import { z } from "zod"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"
import {
  AppwardenApiHostnameSchema,
  AppwardenApiTokenSchema,
  BooleanSchema,
  ValidLockPageSlugSchema,
} from "./helpers"
import {
  AppwardenMiddlewareArraySchema,
  AppwardenMiddlewareConfig,
} from "./middleware-config"
import { UseCSPInputSchema } from "./use-content-security-policy"

export const AppwardenMultidomainConfigSchema = z.record(
  z.string(),
  z.object({
    lockPageSlug: ValidLockPageSlugSchema,
    contentSecurityPolicy: z.lazy(() => UseCSPInputSchema).optional(),
    debug: BooleanSchema.optional(),
  }),
)

export type AppwardenMultidomainConfig = z.infer<
  typeof AppwardenMultidomainConfigSchema
>

export {
  ApiLockResponseSchema,
  ApiMiddlewareConfigSchema,
  AppwardenMiddlewareArraySchema,
  MiddlewareOptionsSchema,
  ServiceMiddlewareSchema,
  WebsiteMiddlewareConfigSchema,
  type ApiLockResponse,
  type ApiMiddlewareConfig,
  type AppwardenMiddlewareConfig,
  type MiddlewareOptions,
  type ResolvedMiddlewareConfig,
  type ServiceMiddleware,
  type WebsiteMiddlewareConfig,
} from "./middleware-config"

// Base schema without refinement - can be extended by other schemas
export const UseAppwardenInputSchema = z.object({
  debug: BooleanSchema.default(false),
  lockPageSlug: ValidLockPageSlugSchema.optional(),
  contentSecurityPolicy: z.lazy(() => UseCSPInputSchema).optional(),
  multidomainConfig: AppwardenMultidomainConfigSchema.optional(),
  appwardenMiddleware: AppwardenMiddlewareArraySchema.optional(),
  appwardenApiToken: AppwardenApiTokenSchema,
  appwardenApiHostname: AppwardenApiHostnameSchema.optional(),
})

export type UseAppwardenInput = z.infer<typeof UseAppwardenInputSchema>

// Refinement to ensure either lockPageSlug, multidomainConfig, or appwardenMiddleware is provided
export const lockPageSlugRefinement = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (data: {
      lockPageSlug?: string
      multidomainConfig?: AppwardenMultidomainConfig
      appwardenMiddleware?: AppwardenMiddlewareConfig[]
    }) =>
      data.lockPageSlug ||
      data.multidomainConfig ||
      (data.appwardenMiddleware && data.appwardenMiddleware.length > 0),
    {
      message:
        AppwardenConfigErrorMessages[
          AppwardenConfigErrorKey.LockPageSlugRequired
        ],
      params: {
        appwardenErrorKey: AppwardenConfigErrorKey.LockPageSlugRequired,
      },
    },
  )

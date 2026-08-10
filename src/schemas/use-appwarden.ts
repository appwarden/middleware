import { z } from "zod"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"
import {
  ApiMiddlewareConfigType,
  AppwardenMiddlewareConfigSchema,
  DomainMiddlewareOptionsSchema,
  MiddlewareOptionsSchema,
  MiddlewareOptionsType,
  WebsiteMiddlewareConfigType,
} from "./middleware-options"

export const AppwardenMultidomainConfigSchema = z.record(
  z.string(),
  DomainMiddlewareOptionsSchema,
)

export type AppwardenMultidomainConfig = z.infer<
  typeof AppwardenMultidomainConfigSchema
>

const AppwardenMiddlewareRouteSchema = z.object({
  url: z.string(),
  options: MiddlewareOptionsSchema,
})

export const AppwardenMiddlewareArraySchema = z.array(
  AppwardenMiddlewareRouteSchema,
)

export const UseAppwardenInputSchema = AppwardenMiddlewareConfigSchema.extend({
  appwardenMiddleware: AppwardenMiddlewareArraySchema.optional(),
  multidomainConfig: AppwardenMultidomainConfigSchema.optional(),
})

export type UseAppwardenInput = z.infer<typeof UseAppwardenInputSchema>

export const appwardenConfigRefinement = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (data: {
      website?: WebsiteMiddlewareConfigType
      api?: ApiMiddlewareConfigType
      multidomainConfig?: AppwardenMultidomainConfig
      appwardenMiddleware?: { url: string; options: MiddlewareOptionsType }[]
    }) =>
      !!data.website ||
      !!data.api ||
      !!data.multidomainConfig ||
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

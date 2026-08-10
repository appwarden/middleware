import { z } from "zod"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"
import {
  ApiMiddlewareConfigType,
  AppwardenMiddlewareConfigSchema,
  DomainMiddlewareOptionsSchema,
  WebsiteMiddlewareConfigType,
} from "./middleware-options"

export const AppwardenMultidomainConfigSchema = z.record(
  z.string(),
  DomainMiddlewareOptionsSchema,
)

export type AppwardenMultidomainConfig = z.infer<
  typeof AppwardenMultidomainConfigSchema
>

export const UseAppwardenInputSchema = AppwardenMiddlewareConfigSchema.extend({
  multidomainConfig: AppwardenMultidomainConfigSchema.optional(),
})

export type UseAppwardenInput = z.infer<typeof UseAppwardenInputSchema>

export const appwardenConfigRefinement = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (data: {
      website?: WebsiteMiddlewareConfigType
      api?: ApiMiddlewareConfigType
      multidomainConfig?: AppwardenMultidomainConfig
    }) => !!data.website || !!data.api || !!data.multidomainConfig,
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

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

/**
 * The config fields inspected by {@link appwardenConfigRefinement}. Declaring
 * them explicitly keeps the refinement callback strongly typed in Zod 4, where
 * `z.ZodTypeAny` infers `unknown` for the parsed value.
 */
export type AppwardenConfigRefinementData = {
  website?: WebsiteMiddlewareConfigType
  api?: ApiMiddlewareConfigType
  multidomainConfig?: AppwardenMultidomainConfig
}

export const appwardenConfigRefinement = <
  T extends z.ZodType<AppwardenConfigRefinementData>,
>(
  schema: T,
) =>
  schema.refine(
    (data) => !!data.website || !!data.api || !!data.multidomainConfig,
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

import { z } from "zod"
import { AppwardenApiTokenSchema, BooleanSchema } from "./helpers"

export const AppwardenMultidomainConfigSchema = z.record(
  z.string(),
  z.object({
    lockPageSlug: z.string(),
  }),
)

export type AppwardenMultidomainConfig = z.infer<
  typeof AppwardenMultidomainConfigSchema
>

// Base schema without refinement - can be extended by other schemas
export const UseAppwardenInputSchema = z.object({
  debug: BooleanSchema.default(false),
  lockPageSlug: z.string().optional(),
  multidomainConfig: AppwardenMultidomainConfigSchema.optional(),
  appwardenApiToken: AppwardenApiTokenSchema,
  appwardenApiHostname: z.string().optional(),
})

// Refinement to ensure either lockPageSlug or multidomainConfig is provided
export const lockPageSlugRefinement = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (data: {
      lockPageSlug?: string
      multidomainConfig?: AppwardenMultidomainConfig
    }) => data.lockPageSlug || data.multidomainConfig,
    {
      message: "lockPageSlug must be provided",
    },
  )

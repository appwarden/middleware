import { z } from "zod"
import { AppwardenApiTokenSchema, BooleanSchema } from "./helpers"

/**
 * Zod schema for TanStack Start Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const TanStackStartCloudflareConfigSchema = z.object({
  /** The slug/path of the lock page to redirect to when the site is locked */
  lockPageSlug: z.string(),
  /** The Appwarden API token for authentication */
  appwardenApiToken: AppwardenApiTokenSchema,
  /** Optional custom API hostname (defaults to https://api.appwarden.io) */
  appwardenApiHostname: z.string().optional(),
  /** Enable debug logging */
  debug: BooleanSchema.default(false),
})

export type TanStackStartCloudflareConfig = z.infer<
  typeof TanStackStartCloudflareConfigSchema
>

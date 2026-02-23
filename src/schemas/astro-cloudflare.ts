import { z } from "zod"
import { AppwardenApiTokenSchema, BooleanSchema } from "./helpers"
import { UseCSPInputSchema } from "./use-content-security-policy"

/**
 * Zod schema for Astro Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const AstroCloudflareConfigSchema = z.object({
  /** The slug/path of the lock page to redirect to when the site is locked */
  lockPageSlug: z.string(),
  /** The Appwarden API token for authentication */
  appwardenApiToken: AppwardenApiTokenSchema,
  /** Optional custom API hostname (defaults to https://api.appwarden.io) */
  appwardenApiHostname: z.string().optional(),
  /** Enable debug logging */
  debug: BooleanSchema.default(false),
  /** Optional Content Security Policy configuration */
  contentSecurityPolicy: z.lazy(() => UseCSPInputSchema).optional(),
})

export type AstroCloudflareConfig = z.infer<typeof AstroCloudflareConfigSchema>

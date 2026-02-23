import { z } from "zod"
import { AppwardenApiTokenSchema, BooleanSchema } from "./helpers"
import { UseCSPInputSchema } from "./use-content-security-policy"

/**
 * Zod schema for Next.js Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const NextJsCloudflareConfigSchema = z.object({
  /** The slug/path of the lock page to redirect to when the site is locked */
  lockPageSlug: z.string(),
  /** The Appwarden API token for authentication */
  appwardenApiToken: AppwardenApiTokenSchema,
  /** Optional custom API hostname (defaults to https://api.appwarden.io) */
  appwardenApiHostname: z.string().optional(),
  /** Enable debug logging */
  debug: BooleanSchema.default(false),
  /** Optional Content Security Policy configuration (headers only, no HTML rewriting) */
  contentSecurityPolicy: z.lazy(() => UseCSPInputSchema).optional(),
})

export type NextJsCloudflareConfig = z.infer<
  typeof NextJsCloudflareConfigSchema
>

import { z } from "zod"
import { AppwardenApiTokenSchema, BooleanSchema } from "./helpers"
import { UseCSPInputSchema } from "./use-content-security-policy"

const NextJsCloudflareCSPInputSchema = UseCSPInputSchema.refine(
  (values) => {
    if (!values.directives) return true

    const serialized = JSON.stringify(values.directives)
    return !serialized.includes("{{nonce}}")
  },
  {
    path: ["directives"],
    message:
      "Nonce-based CSP is not supported in the Next.js Cloudflare adapter. Remove '{{nonce}}' placeholders from your CSP directives, as this adapter does not inject nonces into HTML.",
  },
)

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
  /** Optional Content Security Policy configuration (headers only, no HTML rewriting; '{{nonce}}' is not supported) */
  contentSecurityPolicy: z
    .lazy(() => NextJsCloudflareCSPInputSchema)
    .optional(),
})

export type NextJsCloudflareConfig = z.infer<
  typeof NextJsCloudflareConfigSchema
>

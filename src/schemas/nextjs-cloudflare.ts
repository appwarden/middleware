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
      AppwardenConfigErrorMessages[
        AppwardenConfigErrorKey.NextJsNonceUnsupported
      ],
    params: {
      appwardenErrorKey: AppwardenConfigErrorKey.NextJsNonceUnsupported,
    },
  },
)

/**
 * Zod schema for Next.js Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const NextJsCloudflareConfigSchema = z.object({
  /** The slug/path of the lock page to redirect to when the site is locked */
  lockPageSlug: ValidLockPageSlugSchema,
  /** The Appwarden API token for authentication */
  appwardenApiToken: AppwardenApiTokenSchema,
  /** Optional custom API hostname (defaults to https://api.appwarden.io) */
  appwardenApiHostname: AppwardenApiHostnameSchema.optional(),
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

/**
 * Input type for Next.js Cloudflare adapter configuration.
 * This is the pre-transformation type that accepts string | boolean for debug
 * and string | object for CSP directives, allowing users to pass environment
 * variables directly without manual transformation.
 */
export type NextJsCloudflareConfigInput = z.input<
  typeof NextJsCloudflareConfigSchema
>

import { z } from "zod"
import { AppwardenMiddlewareConfigSchema } from "./middleware-options"

/**
 * Zod schema for Astro Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const AstroCloudflareConfigSchema = AppwardenMiddlewareConfigSchema

export type AstroCloudflareConfig = z.infer<typeof AstroCloudflareConfigSchema>

/**
 * Input type for Astro Cloudflare adapter configuration.
 * This is the pre-transformation type that accepts string | boolean for debug
 * and string | object for CSP directives, allowing users to pass environment
 * variables directly without manual transformation.
 */
export type AstroCloudflareConfigInput = z.input<
  typeof AstroCloudflareConfigSchema
>

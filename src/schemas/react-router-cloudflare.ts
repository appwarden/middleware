import { z } from "zod"
import { AppwardenMiddlewareConfigSchema } from "./middleware-options"

/**
 * Zod schema for React Router Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const ReactRouterCloudflareConfigSchema = AppwardenMiddlewareConfigSchema

export type ReactRouterCloudflareConfig = z.infer<
  typeof ReactRouterCloudflareConfigSchema
>

/**
 * Input type for React Router Cloudflare adapter configuration.
 * This is the pre-transformation type that accepts string | boolean for debug
 * and string | object for CSP directives, allowing users to pass environment
 * variables directly without manual transformation.
 */
export type ReactRouterAppwardenConfigInput = z.input<
  typeof ReactRouterCloudflareConfigSchema
>

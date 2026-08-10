import { z } from "zod"
import { AppwardenMiddlewareConfigNextJsSchema } from "./middleware-options"

/**
 * Zod schema for Next.js Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const NextJsCloudflareConfigSchema =
  AppwardenMiddlewareConfigNextJsSchema

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

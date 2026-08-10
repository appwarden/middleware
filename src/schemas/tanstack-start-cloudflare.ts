import { z } from "zod"
import { AppwardenMiddlewareConfigSchema } from "./middleware-options"

/**
 * Zod schema for TanStack Start Cloudflare adapter configuration.
 * Validates the config object returned by the configFn.
 */
export const TanStackStartCloudflareConfigSchema =
  AppwardenMiddlewareConfigSchema

export type TanStackStartCloudflareConfig = z.infer<
  typeof TanStackStartCloudflareConfigSchema
>

export type TanStackStartCloudflareConfigInput = z.input<
  typeof TanStackStartCloudflareConfigSchema
>

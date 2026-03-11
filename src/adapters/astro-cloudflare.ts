import type { Runtime } from "@astrojs/cloudflare"
import type { MiddlewareHandler } from "astro"
import { waitUntil } from "cloudflare:workers"
import { HEARTBEAT_SERVICES } from "../constants"
import { checkLockStatus } from "../core"
import type {
  AstroCloudflareConfig,
  AstroCloudflareConfigInput,
} from "../schemas/astro-cloudflare"
import { AstroCloudflareConfigSchema } from "../schemas/astro-cloudflare"
import {
  buildLockPageUrl,
  createHeartbeatConfigError,
  createRedirect,
  debug,
  handleHeartbeatRequest,
  isHeartbeatRequest,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
  sanitizeConfigErrors,
  TEMPORARY_REDIRECT_STATUS,
} from "../utils"
import { applyContentSecurityPolicyToResponse } from "../utils/apply-content-security-policy-to-response"
import { getNowMs, logElapsed } from "../utils/get-now"
import { isResponseLike } from "../utils/is-response-like"

const createAstroHeartbeatResponse = (
  request: Request,
  runtime: AstroCloudflareRuntime | undefined,
  configFn: AstroConfigFn,
): Response => {
  if (!runtime) {
    return handleHeartbeatRequest(
      request,
      HEARTBEAT_SERVICES.CLOUDFLARE_ASTRO,
      [
        createHeartbeatConfigError(
          ["runtime"],
          "custom",
          "Cloudflare runtime unavailable",
        ),
      ],
    )
  }

  try {
    const validationResult = AstroCloudflareConfigSchema.safeParse(
      configFn(runtime),
    )

    return handleHeartbeatRequest(
      request,
      HEARTBEAT_SERVICES.CLOUDFLARE_ASTRO,
      validationResult.success
        ? []
        : sanitizeConfigErrors(validationResult.error),
    )
  } catch {
    return handleHeartbeatRequest(
      request,
      HEARTBEAT_SERVICES.CLOUDFLARE_ASTRO,
      [
        createHeartbeatConfigError(
          ["config"],
          "custom",
          "Appwarden config evaluation failed",
        ),
      ],
    )
  }
}

/**
 * Cloudflare runtime context provided by Astro on Cloudflare Workers.
 * This is extracted from the locals object when using @astrojs/cloudflare adapter.
 *
 * Note: Uses generic CloudflareEnv which should be defined in the user's project.
 */
export type AstroCloudflareRuntime = Runtime<CloudflareEnv>["runtime"]

/**
 * Locals interface with Cloudflare runtime.
 * This is the expected shape of context.locals when using @astrojs/cloudflare.
 */
interface LocalsWithRuntime {
  runtime?: AstroCloudflareRuntime
  [key: string]: unknown
}

/**
 * Configuration for the Appwarden middleware.
 *
 * This is an alias of the validated output type from
 * AstroCloudflareConfigSchema, so it always stays in sync with the
 * actual runtime config contract.
 */
export type AstroAppwardenConfig = AstroCloudflareConfig

// Re-export the config types so consumers can reference them from this adapter
// without importing from the internal schema module.
export type { AstroCloudflareConfig, AstroCloudflareConfigInput }

/**
 * Configuration function that receives the Cloudflare runtime and returns the config.
 * This allows dynamic configuration based on environment variables.
 * Accepts pre-transformation input types (e.g., string | boolean for debug, string | object for CSP directives).
 */
export type AstroConfigFn = (
  runtime: AstroCloudflareRuntime,
) => AstroCloudflareConfigInput

/**
 * Creates an Appwarden middleware function for Astro.
 *
 * This middleware checks if the site is locked and redirects to the lock page if so.
 * It should be used with Astro's `sequence()` function or exported directly as `onRequest`.
 *
 * @example
 * ```typescript
 * // src/middleware.ts
 * import { sequence } from "astro:middleware"
 * import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/astro"
 *
 * const appwarden = createAppwardenMiddleware(({ env }) => ({
 *   lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *   appwardenApiToken: env.APPWARDEN_API_TOKEN,
 * }))
 *
 * export const onRequest = sequence(appwarden)
 * ```
 *
 * @param configFn - A function that receives the Cloudflare runtime and returns the config
 * @returns An Astro middleware function
 */
export function createAppwardenMiddleware(
  configFn: AstroConfigFn,
): MiddlewareHandler {
  return async (context, next) => {
    const startTime = getNowMs()
    const { request } = context
    let config: AstroCloudflareConfig
    let debugFn: ReturnType<typeof debug>
    const requestUrl = new URL(request.url)

    const applyCspToResponse = async (
      response: Response,
    ): Promise<Response> => {
      if (!config.contentSecurityPolicy || !isResponseLike(response)) {
        return response
      }

      try {
        return await applyContentSecurityPolicyToResponse({
          request,
          response,
          hostname: requestUrl.hostname,
          waitUntil,
          debug: debugFn,
          contentSecurityPolicy: config.contentSecurityPolicy,
        })
      } catch (error) {
        console.error(
          printMessage(
            `Failed to apply content security policy: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
        return response
      }
    }
    // Cast locals to include runtime property added by @astrojs/cloudflare
    const locals = context.locals as LocalsWithRuntime

    if (isHeartbeatRequest(request, requestUrl)) {
      return createAstroHeartbeatResponse(request, locals.runtime, configFn)
    }

    try {
      // Get Cloudflare runtime from Astro locals
      const runtime = locals.runtime
      if (!runtime) {
        console.error(
          printMessage(
            "Cloudflare runtime not found. Ensure @astrojs/cloudflare adapter is configured.",
          ),
        )
        return next()
      }

      // Get config from the config function (pre-transformation input)
      const rawConfig = configFn(runtime)

      // Validate and transform config against schema
      const validationResult = AstroCloudflareConfigSchema.safeParse(rawConfig)
      if (!validationResult.success) {
        console.error(
          printMessage(
            `Config validation failed: ${validationResult.error.message}`,
          ),
        )
        return next()
      }

      // Use the validated and transformed config
      config = validationResult.data
      debugFn = debug(config.debug)
      const isHTML = isHTMLRequest(request)

      debugFn(
        `Appwarden middleware invoked for ${requestUrl.pathname}`,
        `isHTML: ${isHTML}`,
      )

      // Skip non-HTML requests (e.g., API calls, static assets)
      if (!isHTML) {
        return next()
      }

      if (isOnLockPage(config.lockPageSlug, request.url)) {
        debugFn("Already on lock page - skipping lock status check")
      } else {
        // Check lock status
        const result = await checkLockStatus({
          request,
          appwardenApiToken: config.appwardenApiToken,
          appwardenApiHostname: config.appwardenApiHostname,
          debug: config.debug,
          lockPageSlug: config.lockPageSlug,
          waitUntil,
        })

        // If locked, redirect to lock page
        if (result.isLocked) {
          const lockPageUrl = buildLockPageUrl(config.lockPageSlug, request.url)
          debugFn(`Website is locked - redirecting to ${lockPageUrl.pathname}`)

          // Use Astro's redirect helper if available, otherwise create our own redirect
          if (context.redirect) {
            return context.redirect(
              lockPageUrl.toString(),
              TEMPORARY_REDIRECT_STATUS,
            )
          }
          return createRedirect(lockPageUrl)
        }

        debugFn("Website is unlocked")
      }
    } catch (error) {
      // Re-throw redirects and responses
      if (isResponseLike(error)) {
        throw error
      }

      // Log other errors but don't block the request
      console.error(
        printMessage(
          `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      )
      return next()
    }

    const response = await next()
    const finalResponse = await applyCspToResponse(response)
    logElapsed(debugFn, startTime)
    return finalResponse
  }
}

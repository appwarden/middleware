import { waitUntil } from "cloudflare:workers"
import { APPWARDEN_HEARTBEAT_ROUTE } from "../constants"
import { checkLockStatus } from "../core"
import type { ReactRouterCloudflareConfig } from "../schemas/react-router-cloudflare"
import {
  type ReactRouterAppwardenConfigInput,
  ReactRouterCloudflareConfigSchema,
} from "../schemas/react-router-cloudflare"
import {
  buildLockPageUrl,
  createRedirect,
  debug,
  isHTMLRequest,
  isOnLockPage,
  printMessage,
} from "../utils"
import { applyContentSecurityPolicyToResponse } from "../utils/apply-content-security-policy-to-response"
import { getNowMs, logElapsed } from "../utils/get-now"
import { isResponseLike } from "../utils/is-response-like"

/**
 * Configuration function that returns the config.
 * This allows dynamic configuration based on environment variables from cloudflare:workers.
 * The config can use the relaxed input types (string | boolean for debug,
 * string | object for CSP directives) which will be transformed by Zod.
 *
 * @param runtime - Optional runtime context (for backward compatibility)
 */
export type ReactRouterConfigFn = (
  runtime?: unknown,
) => ReactRouterAppwardenConfigInput

/**
 * React Router middleware function signature.
 * This matches the unstable_middleware export type in React Router v7.
 */
export interface ReactRouterMiddlewareArgs {
  request: Request
  params: Record<string, string | undefined>
}

export type ReactRouterMiddlewareFunction = (
  args: ReactRouterMiddlewareArgs,
  next: () => Promise<void | Response>,
) => Promise<void | Response>

/**
 * Creates an Appwarden middleware function for React Router.
 *
 * This middleware checks if the site is locked and redirects to the lock page if so.
 * It should be exported from your root route (root.tsx) to protect all routes.
 *
 * @example
 * ```typescript
 * // app/root.tsx
 * import { env } from "cloudflare:workers"
 * import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/react-router"
 *
 * export const unstable_middleware = [
 *   createAppwardenMiddleware(() => ({
 *     lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *     appwardenApiToken: env.APPWARDEN_API_TOKEN,
 *   })),
 * ]
 * ```
 *
 * @param configFn - A function that returns the config using env from cloudflare:workers
 * @returns A React Router middleware function
 */
export function createAppwardenMiddleware(
  configFn: ReactRouterConfigFn,
): ReactRouterMiddlewareFunction {
  return async (args, next) => {
    const startTime = getNowMs()
    const { request } = args
    let config: ReactRouterCloudflareConfig
    let debugFn: ReturnType<typeof debug>
    let requestUrl: URL

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

    try {
      requestUrl = new URL(request.url)

      // Handle heartbeat requests BEFORE any other processing
      // This must work even when the site is locked
      if (requestUrl.pathname === APPWARDEN_HEARTBEAT_ROUTE) {
        const {
          createHeartbeatConfigError,
          handleHeartbeatRequest,
          sanitizeConfigErrors,
        } = await import("../utils")
        const { HEARTBEAT_SERVICES } = await import("../constants")

        try {
          // Get config from the config function (using input type - will be validated)
          const configInput = configFn()

          // Validate config
          const validationResult =
            ReactRouterCloudflareConfigSchema.safeParse(configInput)

          return handleHeartbeatRequest(
            request,
            HEARTBEAT_SERVICES.CLOUDFLARE_REACT_ROUTER,
            validationResult.success
              ? []
              : sanitizeConfigErrors(validationResult.error),
          )
        } catch {
          return handleHeartbeatRequest(
            request,
            HEARTBEAT_SERVICES.CLOUDFLARE_REACT_ROUTER,
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

      // Get config from the config function (using input type - will be validated)
      const configInput = configFn()

      // Validate and transform config against schema
      const validationResult =
        ReactRouterCloudflareConfigSchema.safeParse(configInput)
      if (!validationResult.success) {
        console.error(
          printMessage(
            `Config validation failed: ${validationResult.error.message}`,
          ),
        )
        return next()
      }

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
          throw createRedirect(lockPageUrl)
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
    const finalResponse = isResponseLike(response)
      ? await applyCspToResponse(response)
      : response
    logElapsed(debugFn, startTime)
    return finalResponse
  }
}

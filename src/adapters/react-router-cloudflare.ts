import { waitUntil } from "cloudflare:workers"
import { ZodError } from "zod"
import { HEARTBEAT_SERVICES } from "../constants"
import type { ReactRouterCloudflareConfig } from "../schemas/react-router-cloudflare"
import {
  type ReactRouterAppwardenConfigInput,
  ReactRouterCloudflareConfigSchema,
} from "../schemas/react-router-cloudflare"
import {
  createHeartbeatConfigError,
  createRedirect,
  debug,
  handleHeartbeatRequest,
  isHeartbeatRequest,
  parseApiToken,
  printMessage,
  sanitizeConfigErrors,
} from "../utils"
import { resolveAdapterAction } from "../utils/adapter-common"
import { applyContentSecurityPolicyToResponse } from "../utils/apply-content-security-policy-to-response"
import { parseMergedConfig } from "../utils/get-appwarden-configuration"
import { getNowMs, logElapsed } from "../utils/get-now"
import { isResponseLike } from "../utils/is-response-like"

export function getAppwardenConfiguration(
  generatedConfig: Record<string, unknown>,
  config: Partial<ReactRouterAppwardenConfigInput>,
): ReactRouterCloudflareConfig {
  return parseMergedConfig(
    generatedConfig,
    config as Record<string, unknown>,
    ReactRouterCloudflareConfigSchema.parse,
  )
}

const createConfigEvaluationHeartbeatResponse = (
  request: Request,
  publicId: string,
  configErrors = [
    createHeartbeatConfigError(
      ["config"],
      "custom",
      "Appwarden config evaluation failed",
    ),
  ],
): Response => {
  return handleHeartbeatRequest(
    request,
    HEARTBEAT_SERVICES.CLOUDFLARE_REACT_ROUTER,
    publicId,
    configErrors,
  )
}

const handleReactRouterHeartbeatRequest = (
  request: Request,
  configFn: ReactRouterConfigFn,
): Response => {
  try {
    const rawConfig = configFn()
    const validationResult =
      ReactRouterCloudflareConfigSchema.safeParse(rawConfig)
    const configErrors = validationResult.success
      ? []
      : sanitizeConfigErrors(validationResult.error)
    const rawToken = (rawConfig as { appwardenApiToken?: string })
      .appwardenApiToken
    const publicId = validationResult.success
      ? (parseApiToken(validationResult.data.appwardenApiToken)?.publicId ?? "")
      : (parseApiToken(rawToken ?? "")?.publicId ?? "")

    return handleHeartbeatRequest(
      request,
      HEARTBEAT_SERVICES.CLOUDFLARE_REACT_ROUTER,
      publicId,
      configErrors,
    )
  } catch (error) {
    return createConfigEvaluationHeartbeatResponse(
      request,
      "",
      error instanceof ZodError ? sanitizeConfigErrors(error) : undefined,
    )
  }
}

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
) => ReactRouterAppwardenConfigInput | ReactRouterCloudflareConfig

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
 *     website: {
 *       lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
 *     },
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
    const requestUrl = new URL(request.url)

    const applyCspToResponse = async (
      response: Response,
    ): Promise<Response> => {
      if (
        !config.website?.cspMode ||
        config.website.cspMode === "disabled" ||
        !isResponseLike(response)
      ) {
        return response
      }

      try {
        return await applyContentSecurityPolicyToResponse({
          request,
          response,
          hostname: requestUrl.hostname,
          waitUntil,
          debug: debugFn,
          contentSecurityPolicy: {
            mode: config.website.cspMode,
            directives: config.website.cspDirectives ?? {},
          },
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

    if (isHeartbeatRequest(request, requestUrl)) {
      return handleReactRouterHeartbeatRequest(request, configFn)
    }

    try {
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

      const action = await resolveAdapterAction(request, config, waitUntil)

      if (action.type === "api-locked") {
        return action.response
      }

      if (action.type === "website-locked") {
        const lockPageUrl = action.lockPageUrl
        debugFn(`Website is locked - redirecting to ${lockPageUrl.pathname}`)
        throw createRedirect(lockPageUrl)
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

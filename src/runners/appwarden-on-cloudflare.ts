import { ZodError } from "zod"
import { HEARTBEAT_SERVICES } from "../constants"
import { useAppwarden, useContentSecurityPolicy } from "../middlewares"
import { useFetchOrigin } from "../middlewares/use-fetch-origin"
import {
  appwardenConfigRefinement,
  CloudflareConfigFnType,
  ConfigFnInputSchema,
  UseAppwardenInputSchema,
} from "../schemas"
import { Bindings, MiddlewareContext, RequestContext } from "../types"
import {
  createHeartbeatConfigError,
  debug,
  handleHeartbeatRequest,
  isHeartbeatRequest,
  parseApiToken,
  sanitizeConfigErrors,
  usePipeline,
} from "../utils"
import { insertErrorLogs } from "../utils/cloudflare"
import { parseMergedConfig } from "../utils/get-appwarden-configuration"

const RefinedUseAppwardenInputSchema = appwardenConfigRefinement(
  UseAppwardenInputSchema,
)

/**
 * Best-effort publicId extraction from the raw config function result.
 * Used when schema validation of the config failed, so the heartbeat can
 * still be correlated with the site. Never throws.
 */
const getRawConfigPublicId = (
  inputFn: CloudflareConfigFnType,
  requestContext: RequestContext,
): string => {
  try {
    const rawConfig =
      typeof inputFn === "function" ? inputFn(requestContext) : undefined
    const rawToken =
      rawConfig !== null && typeof rawConfig === "object"
        ? (rawConfig as { appwardenApiToken?: unknown }).appwardenApiToken
        : undefined
    return typeof rawToken === "string"
      ? (parseApiToken(rawToken)?.publicId ?? "")
      : ""
  } catch {
    return ""
  }
}

export function getAppwardenConfiguration(
  generatedConfig: Record<string, unknown>,
  config: Partial<ReturnType<typeof RefinedUseAppwardenInputSchema.parse>>,
): ReturnType<typeof RefinedUseAppwardenInputSchema.parse> {
  return parseMergedConfig(
    generatedConfig,
    config as Record<string, unknown>,
    RefinedUseAppwardenInputSchema.parse,
  )
}

export const appwardenOnCloudflare =
  (inputFn: CloudflareConfigFnType): ExportedHandlerFetchHandler<Bindings> =>
  async (request, env, ctx) => {
    ctx.passThroughOnException()

    const requestUrl = new URL(request.url)

    const requestContext = {
      env,
      ctx,
    }

    // Parse config once before any processing
    const parsedInput = ConfigFnInputSchema.safeParse(inputFn)

    // Handle heartbeat requests BEFORE any other processing
    // This must work even when the site is locked
    if (isHeartbeatRequest(request, requestUrl)) {
      // Return heartbeat response with config errors if validation failed
      let resolvedConfig:
        ReturnType<typeof RefinedUseAppwardenInputSchema.parse> | undefined
      let configErrors = parsedInput.success
        ? []
        : sanitizeConfigErrors(parsedInput.error)

      if (parsedInput.success) {
        try {
          resolvedConfig = parsedInput.data(requestContext)
        } catch (error) {
          if (error instanceof ZodError) {
            configErrors = sanitizeConfigErrors(error)
          } else {
            configErrors = [
              createHeartbeatConfigError(
                ["config"],
                "custom",
                "Appwarden config evaluation failed",
              ),
            ]
          }
        }
      }

      // Fall back to the raw config result so a valid token still surfaces
      // its publicId when other config fields fail validation
      const publicId = resolvedConfig
        ? (parseApiToken(resolvedConfig.appwardenApiToken)?.publicId ?? "")
        : getRawConfigPublicId(inputFn, requestContext)

      return handleHeartbeatRequest(
        request,
        HEARTBEAT_SERVICES.CLOUDFLARE,
        publicId,
        configErrors,
      )
    }
    if (!parsedInput.success) {
      // Create a temporary context for error logging (without debug since we don't have config yet)
      const tempContext: MiddlewareContext = {
        request,
        hostname: requestUrl.hostname,
        response: new Response("Unhandled response"),
        waitUntil: (fn: any) => ctx.waitUntil(fn),
        debug: () => {}, // no-op debug for error case
      }
      return insertErrorLogs(tempContext, parsedInput.error)
    }

    let input
    try {
      input = parsedInput.data(requestContext)
    } catch (error) {
      if (error instanceof ZodError) {
        // Create a temporary context for error logging (without debug since we don't have config yet)
        const tempContext: MiddlewareContext = {
          request,
          hostname: requestUrl.hostname,
          response: new Response("Unhandled response"),
          waitUntil: (fn: any) => ctx.waitUntil(fn),
          debug: () => {}, // no-op debug for error case
        }
        return insertErrorLogs(tempContext, error)
      }

      throw error
    }

    // Resolve debug value per-domain: check multidomainConfig[hostname].debug first,
    // then fall back to top-level debug
    const domainDebug =
      input.multidomainConfig?.[requestUrl.hostname]?.debug ??
      input.debug ??
      false

    // Create context with debug function initialized from resolved debug value
    const context: MiddlewareContext = {
      request,
      hostname: requestUrl.hostname,
      response: new Response("Unhandled response"),
      // https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
      waitUntil: (fn: any) => ctx.waitUntil(fn),
      debug: debug(domainDebug),
    }

    try {
      // Pass input directly to useAppwarden; it resolves per-domain options internally.
      const pipeline = [useAppwarden(input), useFetchOrigin()]

      // Add CSP middleware after origin using per-domain website config first,
      // then fall back to the top-level website configuration.
      const domainWebsite =
        input.multidomainConfig?.[requestUrl.hostname]?.website ?? input.website
      const cspConfig =
        domainWebsite?.cspMode && domainWebsite.cspMode !== "disabled"
          ? {
              mode: domainWebsite.cspMode,
              directives: domainWebsite.cspDirectives,
            }
          : undefined

      if (cspConfig) {
        pipeline.push(useContentSecurityPolicy(cspConfig))
      }

      await usePipeline(...pipeline).execute(context)
    } catch (error) {
      if (error instanceof ZodError) {
        return insertErrorLogs(context, error)
      }

      throw error
    }

    return context.response
  }

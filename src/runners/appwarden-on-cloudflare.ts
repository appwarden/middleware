import { ZodError } from "zod"
import { HEARTBEAT_SERVICES } from "../constants"
import { useAppwarden, useContentSecurityPolicy } from "../middlewares"
import { useFetchOrigin } from "../middlewares/use-fetch-origin"
import {
  CloudflareConfigFnType,
  ConfigFnInputSchema,
  lockPageSlugRefinement,
  UseAppwardenInputSchema,
} from "../schemas"
import { Bindings, MiddlewareContext } from "../types"
import {
  createHeartbeatConfigError,
  debug,
  handleHeartbeatRequest,
  isHeartbeatRequest,
  sanitizeConfigErrors,
  usePipeline,
} from "../utils"
import { insertErrorLogs } from "../utils/cloudflare"
import { parseMergedConfig } from "../utils/get-appwarden-configuration"

const RefinedUseAppwardenInputSchema = lockPageSlugRefinement(
  UseAppwardenInputSchema,
)

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
      let configErrors = parsedInput.success
        ? []
        : sanitizeConfigErrors(parsedInput.error)

      if (parsedInput.success) {
        try {
          parsedInput.data(requestContext)
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

      return handleHeartbeatRequest(
        request,
        HEARTBEAT_SERVICES.CLOUDFLARE,
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
      // Pass input with resolved debug value to useAppwarden
      const pipeline = [
        useAppwarden({ ...input, debug: domainDebug }),
        useFetchOrigin(),
      ]

      // Add CSP middleware after origin using per-domain config first,
      // then fall back to the top-level configuration.
      const cspConfig =
        input.multidomainConfig?.[requestUrl.hostname]?.contentSecurityPolicy ??
        input.contentSecurityPolicy

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

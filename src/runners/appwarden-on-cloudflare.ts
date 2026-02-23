import { ZodError } from "zod"
import { useAppwarden, useContentSecurityPolicy } from "../middlewares"
import { useFetchOrigin } from "../middlewares/use-fetch-origin"
import { CloudflareConfigType, ConfigFnInputSchema } from "../schemas"
import { Bindings, MiddlewareContext } from "../types"
import { usePipeline } from "../utils"
import { insertErrorLogs } from "../utils/cloudflare"

export const appwardenOnCloudflare =
  (inputFn: CloudflareConfigType): ExportedHandlerFetchHandler<Bindings> =>
  async (request, env, ctx) => {
    ctx.passThroughOnException()

    const context: MiddlewareContext = {
      request,
      hostname: new URL(request.url).host,
      response: new Response("Unhandled response"),
      // https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors
      waitUntil: (fn: any) => ctx.waitUntil(fn),
    }

    const parsedInput = ConfigFnInputSchema.safeParse(inputFn)
    if (!parsedInput.success) {
      return insertErrorLogs(context, parsedInput.error)
    }

    try {
      const input = parsedInput.data({ env, ctx, cf: {} })

      const pipeline = [useAppwarden(input), useFetchOrigin()]

      // Add CSP middleware after origin if configured.
      // When hostname is provided in the CSP config, only mount the middleware
      // for matching hostnames. This is primarily used with multidomainConfig
      // in the Cloudflare universal middleware.
      const cspConfig = input.contentSecurityPolicy
      if (input.contentSecurityPolicy) {
        const cspHostname = cspConfig.hostname
        if (!cspHostname || cspHostname === context.hostname) {
          pipeline.push(useContentSecurityPolicy(cspConfig))
        }
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

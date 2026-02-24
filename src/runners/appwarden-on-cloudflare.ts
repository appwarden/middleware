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

    const requestUrl = new URL(request.url)

    const context: MiddlewareContext = {
      request,
      hostname: requestUrl.hostname,
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

      // Add CSP middleware after origin if configured for this hostname via multidomainConfig.
      const cspConfig =
        input.multidomainConfig?.[requestUrl.hostname]?.contentSecurityPolicy

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

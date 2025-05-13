import { ZodError } from "zod"
import { useAppwarden } from "../middlewares"
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

      const pipeline = [
        ...input.middleware.before,
        useAppwarden(input),
        useFetchOrigin(),
      ]

      await usePipeline(...pipeline).execute(context)
    } catch (error) {
      if (error instanceof ZodError) {
        return insertErrorLogs(context, error)
      }

      throw error
    }

    return context.response
  }

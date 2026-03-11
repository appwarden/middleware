import { createAppwardenMiddleware } from "../bundles/cloudflare"
import type { Bindings } from "../types"

export default {
  fetch: async (request: Request, env: Bindings, ctx: ExecutionContext) => {
    // Create the Appwarden handler
    const appwardenHandler = createAppwardenMiddleware(({ env: e }) => ({
      debug: e.DEBUG,
      lockPageSlug: e.APPWARDEN_LOCK_PAGE_SLUG,
      appwardenApiToken: e.APPWARDEN_API_TOKEN,
      appwardenApiHostname: e.APPWARDEN_API_HOSTNAME,
      multidomainConfig: {
        "appwarden.io": {
          lockPageSlug: e.APPWARDEN_LOCK_PAGE_SLUG,
          contentSecurityPolicy: {
            mode: e.CSP_MODE,
            directives: e.CSP_DIRECTIVES,
          },
        },
      },
    }))

    // Wrap the handler to add test header
    const wrappedHandler = async (
      req: Request,
      e: Bindings,
      c: ExecutionContext,
    ) => {
      const response = await appwardenHandler(req as any, e, c)
      const newResponse = new Response(response.body, response)
      newResponse.headers.set("test-appwarden-ran", "true")
      return newResponse
    }

    return wrappedHandler(request, env, ctx)
  },
}

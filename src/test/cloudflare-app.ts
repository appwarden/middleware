import { createAppwardenMiddleware } from "../bundles/cloudflare"
export default {
  fetch: async (request: Request, env: any, ctx: any) => {
    // Create the Appwarden handler
    const appwardenHandler = createAppwardenMiddleware(() => ({
      debug: env.DEBUG,
      lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
      appwardenApiToken: env.APPWARDEN_API_TOKEN,
      appwardenApiHostname: env.APPWARDEN_API_HOSTNAME,
      multidomainConfig: {
        "appwarden.io": {
          lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
          contentSecurityPolicy: {
            mode: env.CSP_MODE,
            directives: env.CSP_DIRECTIVES,
          },
        },
      },
    }))

    // Wrap the handler to add test header
    const wrappedHandler = async (req: Request, e: any, c: any) => {
      const response = await appwardenHandler(req as any, e, c)
      const newResponse = new Response(response.body, response)
      newResponse.headers.set("test-appwarden-ran", "true")
      return newResponse
    }

    return wrappedHandler(request, env, ctx)
  },
}

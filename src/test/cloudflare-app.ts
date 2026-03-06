import { appwardenOnCloudflare } from "../runners/appwarden-on-cloudflare"

export default {
  fetch: async (request: Request, env: any, ctx: any) => {
    // Create the Appwarden handler
    const appwardenHandler = appwardenOnCloudflare(
      // @ts-expect-error todo types aren't making it here
      (context) => ({
        debug: context.env.DEBUG,
        lockPageSlug: context.env.LOCK_PAGE_SLUG,
        appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
        appwardenApiHostname: context.env.APPWARDEN_API_HOSTNAME,
        multidomainConfig: {
          "appwarden.io": {
            lockPageSlug: context.env.LOCK_PAGE_SLUG,
            contentSecurityPolicy: {
              mode: context.env.CSP_MODE,
              directives: context.env.CSP_DIRECTIVES,
            },
          },
        },
      }),
    )

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

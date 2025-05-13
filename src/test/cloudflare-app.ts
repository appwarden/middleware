import { withAppwarden } from "../bundles/cloudflare"
import { useContentSecurityPolicy } from "../middlewares"
import { Middleware } from "../types"

const useHeader: (headerName: string) => Middleware =
  (headerName) => async (context, next) => {
    // run the middleware after the origin is fetched
    await next()

    const { response } = context

    const nextResponse = new Response(response.body, response)

    nextResponse.headers.set(headerName, "true")

    context.response = nextResponse
  }

export default {
  fetch: withAppwarden(
    // @ts-expect-error todo types aren't making it here
    (context) => ({
      debug: context.env.DEBUG,
      lockPageSlug: context.env.LOCK_PAGE_SLUG,
      appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
      middleware: {
        before: [
          useHeader("test-appwarden-ran"),
          useContentSecurityPolicy({
            mode: context.env.CSP_MODE,
            directives: context.env.CSP_DIRECTIVES,
          }),
        ],
      },
    }),
  ),
}

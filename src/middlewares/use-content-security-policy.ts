import { UseCSPInput, UseCSPInputSchema } from "../schemas"
import { Middleware } from "../types"
import { debug, printMessage } from "../utils"
import { makeCSPHeader } from "../utils/cloudflare"

const AppendAttribute = (attribute: string, nonce: string) => ({
  element: function (element: Element) {
    element.setAttribute(attribute, nonce)
  },
})

export const useContentSecurityPolicy: (input: UseCSPInput) => Middleware = (
  input,
) => {
  const parsedInput = UseCSPInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw parsedInput.error
  }

  const config = parsedInput.data

  return async (context, next) => {
    // run the middleware after the origin is fetched
    await next()

    // Skip if hostname is configured and doesn't match the request hostname
    if (config.hostname && context.hostname !== config.hostname) {
      return
    }

    const { response } = context

    if (
      // if the csp is disabled
      !["enforced", "report-only"].includes(config.mode)
    ) {
      debug(printMessage("csp is disabled"))
      return
    }
    // or if content type is defined but its not html
    if (
      response.headers.has("Content-Type") &&
      !response.headers.get("Content-Type")?.includes("text/html")
    ) {
      return
    }

    const cspNonce = crypto.randomUUID()

    const [cspHeaderName, cspHeaderValue] = makeCSPHeader(
      cspNonce,
      config.directives,
      config.mode,
    )

    const nextResponse = new Response(response.body, response)

    nextResponse.headers.set(cspHeaderName, cspHeaderValue)
    nextResponse.headers.set("content-type", "text/html; charset=utf-8")

    context.response = new HTMLRewriter()
      .on("style", AppendAttribute("nonce", cspNonce))
      .on("script", AppendAttribute("nonce", cspNonce))
      .transform(nextResponse)
  }
}

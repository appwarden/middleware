import { UseCSPInput, UseCSPInputSchema } from "../schemas"
import { Middleware } from "../types"
import { isHTMLResponse } from "../utils"
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

    const { response } = context

    if (
      // if the csp is disabled
      !["enforced", "report-only"].includes(config.mode)
    ) {
      context.debug("CSP is disabled")
      return
    }
    // or if content type is defined but its not html
    if (response.headers.has("Content-Type") && !isHTMLResponse(response)) {
      return
    }

    const cspNonce = crypto.randomUUID()

    const [cspHeaderName, cspHeaderValue] = makeCSPHeader(
      cspNonce,
      config.directives,
      config.mode,
    )

    context.debug(
      `Applying CSP in ${config.mode} mode`,
      `Directives: ${config.directives ? Object.keys(config.directives).join(", ") : "none"}`,
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

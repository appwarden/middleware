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

    context.debug(`Applying CSP in ${config.mode} mode`)

    // Check if we need to skip HTMLRewriter transformation
    // - 204 No Content and 304 Not Modified must not have a body per HTTP spec
    // - HEAD requests should not have a body
    // - Responses without a body cannot be transformed by HTMLRewriter
    const shouldSkipTransform =
      !response.body ||
      response.status === 204 ||
      response.status === 304 ||
      context.request.method === "HEAD"

    if (shouldSkipTransform) {
      context.debug(
        "Skipping HTMLRewriter transform for response without body or HEAD request",
      )
      // Still apply CSP header, but don't transform the body
      const nextResponse = new Response(response.body, response)
      nextResponse.headers.set(cspHeaderName, cspHeaderValue)
      context.response = nextResponse
      return
    }

    // Clone the response before consuming the body to avoid "body already used" errors
    const nextResponse = new Response(response.clone().body, response)

    nextResponse.headers.set(cspHeaderName, cspHeaderValue)

    // Preserve the original Content-Type charset if present
    const originalContentType = response.headers.get("content-type")
    if (originalContentType) {
      // If the original has a charset, preserve it; otherwise add utf-8
      // Use case-insensitive regex to detect charset parameter
      if (/charset\s*=/i.test(originalContentType)) {
        nextResponse.headers.set("content-type", originalContentType)
      } else {
        nextResponse.headers.set(
          "content-type",
          `${originalContentType}; charset=utf-8`,
        )
      }
    } else {
      // No original Content-Type, set default
      nextResponse.headers.set("content-type", "text/html; charset=utf-8")
    }

    context.response = new HTMLRewriter()
      .on("style", AppendAttribute("nonce", cspNonce))
      .on("script", AppendAttribute("nonce", cspNonce))
      .transform(nextResponse)
  }
}

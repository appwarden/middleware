import { Middleware } from "../types"

export const useFetchOrigin: () => Middleware = () => async (context, next) => {
  // Use "manual" redirect mode only for methods that can have streaming bodies
  // (non-GET/HEAD) to prevent errors when the fetch API cannot retransmit
  // a one-time-use body on redirect. For GET/HEAD, use "follow" to preserve
  // normal redirect semantics.
  const method = context.request.method.toUpperCase()

  context.response = await fetch(
    new Request(context.request, {
      redirect: method === "GET" || method === "HEAD" ? "follow" : "manual",
    }),
  )

  // Log opaque redirects for debugging purposes
  // TypeScript's Response type doesn't include "opaqueredirect" but it exists at runtime
  if ((context.response.type as string) === "opaqueredirect") {
    context.debug(
      "Origin returned a redirect (opaque response) - client will handle redirect",
    )
  }

  await next()
}

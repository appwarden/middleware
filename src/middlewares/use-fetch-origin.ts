import { Middleware } from "../types"

export const useFetchOrigin: () => Middleware = () => async (context, next) => {
  // Use "manual" redirect mode only for methods that can have streaming bodies
  // (non-GET/HEAD) to prevent errors when the fetch API cannot retransmit
  // a one-time-use body on redirect. For GET/HEAD, use "follow" to preserve
  // normal redirect semantics.
  const method = context.request.method.toUpperCase()
  const canHaveStreamingBody = method !== "GET" && method !== "HEAD"

  context.response = await fetch(
    new Request(context.request, {
      redirect: canHaveStreamingBody ? "manual" : "follow",
    }),
  )

  await next()
}

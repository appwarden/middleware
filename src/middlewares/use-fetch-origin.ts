import { Middleware } from "../types"

export const useFetchOrigin: () => Middleware = () => async (context, next) => {
  // Use "manual" redirect mode to prevent errors with streaming POST request bodies
  // When redirect: "follow" is used with a streaming body, the fetch API cannot
  // retransmit the body on redirect, causing a TypeError
  context.response = await fetch(
    new Request(context.request, {
      ...context.request,
      redirect: "manual",
    }),
  )

  await next()
}

import { Middleware } from "../types"

export const useFetchOrigin: () => Middleware = () => async (context, next) => {
  context.response = await fetch(
    new Request(context.request, {
      ...context.request,
      redirect: "follow",
    }),
  )

  await next()
}

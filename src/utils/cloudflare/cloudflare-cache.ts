import { Cache } from "@cloudflare/workers-types"
import { debug } from "../debug"

type Context = {
  cache: Cache
  debug: ReturnType<typeof debug>
  serviceOrigin: string
  waitUntil?: (promise: Promise<unknown>) => void
}

export type JSONStore<T> = {
  getValue: () => Promise<Response | undefined>
  updateValue: (json: T) => Promise<void>
  deleteValue: () => Promise<boolean>
}

export const store = {
  json: <T extends Record<string, any>>(
    context: Context,
    cacheKey: string,
    options?: { ttl: number },
  ) => {
    const cacheKeyUrl = new URL(cacheKey, context.serviceOrigin)

    return {
      getValue: () => getCacheValue(context, cacheKeyUrl),
      updateValue: (json: T) =>
        updateCacheValue(context, cacheKeyUrl, json, options?.ttl),
      deleteValue: () => clearCache(context, cacheKeyUrl),
    }
  },
}

const getCacheValue = async (context: Context, cacheKey: URL) => {
  // Use Request object for cache key to ensure proper matching
  const request = new Request(cacheKey.href)
  const match = await context.cache.match(request)
  return match ?? undefined
}

const updateCacheValue = async (
  context: Context,
  cacheKey: URL,
  value: Record<string, unknown>,
  ttl?: number,
) => {
  context.debug(
    "updating cache...",
    cacheKey.href,
    value,
    ttl ? `expires in ${ttl}s` : "",
  )

  const response = new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json",
      ...(ttl && {
        "cache-control": `max-age=${ttl}`,
      }),
    },
  })

  // Use Request object for cache key to ensure proper matching
  // The Cache API requires a GET request as the key
  const request = new Request(cacheKey.href, { method: "GET" })

  // Always await the cache.put operation
  // The caller can decide whether to use waitUntil or await this function
  await context.cache.put(request, response)
}

const clearCache = (context: Context, cacheKey: URL) => {
  const request = new Request(cacheKey.href)
  return context.cache.delete(request)
}

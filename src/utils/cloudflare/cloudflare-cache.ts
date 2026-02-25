import { Cache } from "@cloudflare/workers-types"
import { debug } from "../debug"

type Context = {
  cache: Cache
  debug: ReturnType<typeof debug>
  serviceOrigin: string
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
  const match = await context.cache.match(cacheKey)
  if (!match) {
    context.debug(`[${cacheKey.pathname}] Cache MISS!`)
    return undefined
  }

  context.debug(`[${cacheKey.pathname}] Cache MATCH!`)
  return match
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

  await context.cache.put(
    cacheKey,
    new Response(JSON.stringify(value), {
      headers: {
        "content-type": "application/json",
        ...(ttl && {
          "cache-control": `max-age=${ttl}`,
        }),
      },
    }),
  )
}

const clearCache = (context: Context, cacheKey: URL) =>
  context.cache.delete(cacheKey)

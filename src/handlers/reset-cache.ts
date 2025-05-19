import { APPWARDEN_CACHE_KEY } from "../constants"
import { LockValueType } from "../schemas"
import { getLockValue, JSONStore } from "../utils/cloudflare"

export const isResetCacheRequest = (request: Request) =>
  request.method === "POST" &&
  new URL(request.url).pathname === "/__appwarden/reset-cache" &&
  request.headers.get("content-type") === "application/json"

export const handleResetCache = async (
  keyName: typeof APPWARDEN_CACHE_KEY,
  provider: "cloudflare-cache",
  edgeCache: JSONStore<LockValueType>,
  request: Request,
) => {
  const { lockValue } = await getLockValue({
    keyName,
    provider,
    edgeCache,
  })

  try {
    const body = await request.clone().json<{ code: string }>()
    if (body.code === lockValue?.code) {
      // https://discord.com/channels/595317990191398933/1074116255134535700/1074116255134535700
      // we set the value to an empty object instead of deleting it to avoid the above issue
      await edgeCache.deleteValue()
    }
  } catch (error) {}
}

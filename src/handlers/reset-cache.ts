import { APPWARDEN_CACHE_KEY } from "../constants"
import { LockValueType } from "../schemas"
import { JSONStore } from "../utils/cloudflare"

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
  try {
    // Reset requests are already gated by `isResetCacheRequest` (method, path, and
    // content-type). We no longer compare any Appwarden "code" value and instead
    // always clear the edge cache for a valid reset request.
    await edgeCache.deleteValue()
  } catch (error) {}
}

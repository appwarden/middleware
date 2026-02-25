import type { NextFetchEvent, NextRequest } from "next/server"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { BaseNextJsConfigFnType, LockValueType } from "../schemas"
import { MemoryCache } from "../utils"

export type VercelProviderContext = Omit<BaseNextJsConfigFnType, "debug"> & {
  req: NextRequest
  requestUrl: URL
  keyName: typeof APPWARDEN_CACHE_KEY
  event: NextFetchEvent
  provider: "edge-config" | "upstash"
  memoryCache: MemoryCache<string, LockValueType>
  waitUntil: NextFetchEvent["waitUntil"]
  debug: (...msg: any[]) => void
}

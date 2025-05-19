import type { getRequestContext } from "@cloudflare/next-on-pages"
import type { NextFetchEvent } from "next/server"
import { APPWARDEN_CACHE_KEY } from "../constants"
import { LockValueType, NextJsConfigFnType } from "../schemas"
import { JSONStore } from "../utils/cloudflare"
import { ContentSecurityPolicyType } from "./csp"

export type RequestContext = ReturnType<typeof getRequestContext>

export type CloudflareProviderContext = ReturnType<NextJsConfigFnType> & {
  request: Request
  requestUrl: URL
  keyName: typeof APPWARDEN_CACHE_KEY
  provider: "cloudflare-cache"
  edgeCache: JSONStore<LockValueType>
  waitUntil: NextFetchEvent["waitUntil"]
}

export type RequestHandler<Env = any> = PagesFunction<Env>

declare global {
  interface CloudflareEnv extends Bindings {}
}

export type Bindings = {
  DEBUG: string | boolean
  LOCK_PAGE_SLUG: string
  CSP_MODE: "disabled" | "report-only" | "enforced"
  CSP_DIRECTIVES: string | ContentSecurityPolicyType
  APPWARDEN_API_TOKEN: string
}

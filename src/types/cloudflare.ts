import type { NextFetchEvent } from "next/server"
import { APPWARDEN_CACHE_KEY } from "../constants"
import type { LockValueType, UseAppwardenInput } from "../schemas"
import type { JSONStore } from "../utils/cloudflare"
import type { ContentSecurityPolicyType } from "./csp"

export type Bindings = {
  DEBUG: string | boolean
  LOCK_PAGE_SLUG: string
  CSP_MODE: "disabled" | "report-only" | "enforced"
  CSP_DIRECTIVES: string | ContentSecurityPolicyType
  APPWARDEN_API_TOKEN: string
  APPWARDEN_API_HOSTNAME?: string
}

declare global {
  interface CloudflareEnv extends Bindings {}
}

/**
 * Cloudflare request context shape used by withAppwarden config functions.
 * This matches the context passed to config functions in appwardenOnCloudflare.
 */
export type RequestContext = {
  env: Bindings
  ctx: ExecutionContext
  cf: unknown
}

export type CloudflareProviderContext = Omit<
  UseAppwardenInput,
  "lockPageSlug"
> & {
  request: Request
  requestUrl: URL
  keyName: typeof APPWARDEN_CACHE_KEY
  provider: "cloudflare-cache"
  edgeCache: JSONStore<LockValueType>
  waitUntil: NextFetchEvent["waitUntil"]
  lockPageSlug: string // Required - context is only created when lockPageSlug is resolved
  appwardenApiHostname?: string
}

export type RequestHandler<Env = any> = PagesFunction<Env>

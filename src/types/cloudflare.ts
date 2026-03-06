import type { NextFetchEvent } from "next/server"
import { APPWARDEN_CACHE_KEY } from "../constants"
import type { LockValueType, UseAppwardenInput } from "../schemas"
import type { JSONStore } from "../utils/cloudflare"
import type { ContentSecurityPolicyType } from "./csp"

/**
 * Fallback bindings type for when Wrangler types are not available.
 * This provides a minimal type definition for development.
 *
 * When users run `wrangler types`, it generates:
 * - `declare namespace Cloudflare { interface Env { ... } }`
 * - `interface Env extends Cloudflare.Env {}`
 *
 * Our CloudflareEnv should pick up the user's generated Env type first.
 */
export type Bindings = {
  DEBUG?: string | boolean
  APPWARDEN_LOCK_PAGE_SLUG?: string
  CSP_MODE?: "disabled" | "report-only" | "enforced"
  CSP_DIRECTIVES?: string | ContentSecurityPolicyType
  APPWARDEN_API_TOKEN?: string
  APPWARDEN_API_HOSTNAME?: string
}

declare global {
  /**
   * CloudflareEnv is the global type used by all adapters.
   *
   * TypeScript's declaration merging means:
   * 1. If user has Wrangler-generated `interface Env`, CloudflareEnv will extend it
   * 2. If not, CloudflareEnv will extend our fallback Bindings type
   *
   * This ensures Wrangler types take precedence when available.
   */
  interface CloudflareEnv extends Env {}

  /**
   * Fallback Env interface when Wrangler types are not generated.
   * If the user runs `wrangler types`, their generated Env will merge with this.
   */
  interface Env extends Bindings {}
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
  "lockPageSlug" | "debug"
> & {
  request: Request
  requestUrl: URL
  keyName: typeof APPWARDEN_CACHE_KEY
  provider: "cloudflare-cache"
  edgeCache: JSONStore<LockValueType>
  waitUntil: NextFetchEvent["waitUntil"]
  lockPageSlug: string // Required - context is only created when lockPageSlug is resolved
  appwardenApiHostname?: string
  debug: (...msg: any[]) => void
}

export type RequestHandler<Env = any> = PagesFunction<Env>

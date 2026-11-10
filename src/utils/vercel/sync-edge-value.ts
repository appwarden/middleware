import { APPWARDEN_MIDDLEWARE_USER_AGENT } from "../../constants"
import { AppwardenApiHostnameSchema } from "../../schemas/helpers"
import { VercelProviderContext } from "../../types"
import {
  ApiRefusalKind,
  classifyApiRefusal,
  readRefusalCode,
} from "../api-refusal"
import { printMessage } from "../print-message"

class APIError extends Error {
  readonly kind: ApiRefusalKind

  constructor(message: string, kind: ApiRefusalKind = "retryable") {
    super(message)
    this.name = "APIError"
    this.kind = kind
  }
}

const API_TIMEOUT_MS = 10_000

function resolveApiHostname(hostname: string | undefined): string {
  if (!hostname) {
    // @ts-expect-error config variables
    return API_HOSTNAME
  }
  const parsed = AppwardenApiHostnameSchema.safeParse(hostname)
  if (!parsed.success) {
    // @ts-expect-error config variables
    return API_HOSTNAME
  }
  return parsed.data
}

/**
 * The outcome of a sync, so a caller can tell a successful sync from a failed one.
 *
 * This adapter used to return nothing and swallow its own failure, which is the same
 * ambiguity the Cloudflare one carried before it gained `{ ok, reason }`. `reason` is the
 * same string that reaches the log; `kind` says whether the next attempt should retry.
 */
export type SyncEdgeValueResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: string
      readonly kind: ApiRefusalKind
    }

export const syncEdgeValue = async (
  context: Pick<
    VercelProviderContext,
    | "cacheUrl"
    | "requestUrl"
    | "vercelApiToken"
    | "appwardenApiToken"
    | "appwardenApiHostname"
    | "debug"
  >,
): Promise<SyncEdgeValueResult> => {
  // we use this log to search vercel logs during testing (see packages/appwarden-vercel/edge-cache-testing-results.md)
  context.debug("syncing with api")

  const apiHostname = resolveApiHostname(context.appwardenApiHostname)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    // @ts-expect-error config variables
    const response = await fetch(new URL(API_PATHNAME, apiHostname), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": APPWARDEN_MIDDLEWARE_USER_AGENT,
      },
      body: JSON.stringify({
        service: "vercel",
        cacheUrl: context.cacheUrl,
        fqdn: context.requestUrl.hostname,
        vercelApiToken: context.vercelApiToken ?? "",
        appwardenApiToken: context.appwardenApiToken,
      }),
      signal: controller.signal,
    })

    if (response.status !== 200) {
      // Classify on the body's code first, status second: a 403 alone cannot separate an
      // unverified domain from a token that can never read this one.
      const code = await readRefusalCode(response)
      const refusal = classifyApiRefusal(response.status, code)

      if (response.status === 403 && !code) {
        // An uncoded 403 is the unverified-domain state, not a token fault. Say so once.
        console.log(printMessage(refusal.message))
        return { ok: false, reason: refusal.message, kind: refusal.kind }
      }

      throw new APIError(refusal.message, refusal.kind)
    }

    if (response.headers.get("content-type")?.includes("application/json")) {
      const result = await response.json<{ error?: { message: string } }>()
      if (result.error) {
        throw new APIError(result.error.message)
      }
    }

    return { ok: true }
  } catch (e) {
    const message = "Failed to fetch from check endpoint"
    const reason =
      e instanceof APIError
        ? e.message
        : e instanceof Error
          ? `${message} - ${e.message}`
          : message
    // A refusal that only a config change can fix is fatal; everything else (a network
    // stall, an unparseable body) is worth retrying on the next request.
    const kind: ApiRefusalKind = e instanceof APIError ? e.kind : "retryable"

    console.error(printMessage(reason))

    return { ok: false, reason, kind }
  } finally {
    clearTimeout(timeout)
  }
}

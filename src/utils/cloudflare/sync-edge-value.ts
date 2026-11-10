import { APPWARDEN_MIDDLEWARE_USER_AGENT } from "../../constants"
import {
  AppwardenApiHostnameSchema,
  LockValue,
  LockValueType,
} from "../../schemas"
import { CloudflareProviderContext } from "../../types/cloudflare"
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

const DEFAULT_API_HOSTNAME = "https://api.appwarden.io"
const API_TIMEOUT_MS = 10_000

function resolveApiHostname(hostname: string | undefined): string {
  if (!hostname) return DEFAULT_API_HOSTNAME
  const parsed = AppwardenApiHostnameSchema.safeParse(hostname)
  if (!parsed.success) return DEFAULT_API_HOSTNAME
  return parsed.data
}

/**
 * Whether the edge cache was updated.
 *
 * `syncEdgeValue` used to return nothing and swallow its own failure, which left the caller
 * unable to tell a successful sync from a failed one — so the next request re-fired it, and
 * an API that is down turned every request on the site into an API call. `reason` is the
 * same string that reaches the log, so a caller can record it without re-rendering it, and
 * `kind` says whether the next pull window should retry (a transient fault) or back off for
 * much longer (a refusal only a config change can fix).
 */
export type SyncEdgeValueResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: string
      readonly kind: ApiRefusalKind
    }

/**
 * Fetches the lock value and writes it to the edge cache.
 *
 * Never throws: the outcome is the return value, because a failure that leaves nothing
 * behind is exactly what the caller has to be able to see.
 */
export const syncEdgeValue = async (
  context: CloudflareProviderContext,
): Promise<SyncEdgeValueResult> => {
  // Use runtime-configured hostname if provided and valid, otherwise fall back to default
  const apiHostname = resolveApiHostname(context.appwardenApiHostname)
  context.debug(`GET ${apiHostname}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    // @ts-expect-error API_PATHNAME is a build-time config variable
    const response = await fetch(new URL(API_PATHNAME, apiHostname), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": APPWARDEN_MIDDLEWARE_USER_AGENT,
      },
      body: JSON.stringify({
        service: "cloudflare",
        provider: context.provider,
        fqdn: context.requestUrl.hostname,
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
        // An uncoded 403 is the unverified-domain state, not a token fault. Say so once,
        // and let the gate retry it on the next pull window.
        console.log(printMessage(refusal.message))
        return { ok: false, reason: refusal.message, kind: refusal.kind }
      }

      throw new APIError(refusal.message, refusal.kind)
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      const result = await response.json<{
        content: LockValueType
        error: { message: string }
      }>()

      if (result.error) {
        throw new APIError(result.error.message)
      }

      if (!result.content) {
        throw new APIError("no content from api")
      }

      try {
        const parsedValue = LockValue.omit({ lastCheck: true }).parse(
          result.content,
        )
        context.debug(`GET ${apiHostname} succeeded`)

        await context.edgeCache.updateValue({
          ...parsedValue,
          lastCheck: Date.now(),
        })

        return { ok: true }
      } catch (error) {
        throw new APIError(`Failed to parse check endpoint result - ${error}`)
      }
    }

    // A 200 that is not JSON leaves nothing cached, so it is a failure for the caller's
    // purposes even though the request itself succeeded. The old shape returned silently
    // here, which read as success to anything watching the outcome.
    const reason = `${apiHostname} answered ${response.status} without JSON`
    console.error(printMessage(reason))

    return { ok: false, reason, kind: "retryable" }
  } catch (e) {
    const message = `GET ${apiHostname} failed`
    const reason =
      e instanceof APIError
        ? e.message
        : e instanceof Error
          ? `${message}: ${e.message}`
          : message
    // A refusal that only a config change can fix is fatal; everything else (a network
    // stall, a 200 with an unparseable body) is worth retrying on the next request.
    const kind: ApiRefusalKind = e instanceof APIError ? e.kind : "retryable"

    console.error(printMessage(reason))

    return { ok: false, reason, kind }
  } finally {
    clearTimeout(timeout)
  }
}

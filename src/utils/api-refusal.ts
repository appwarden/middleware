/**
 * Classifies an Appwarden API refusal so every call site can name the fix an operator has
 * to make, rather than the status line.
 *
 * The API answers every refusal on the token surface with a machine-readable `error.code`.
 * The code is the part callers are meant to branch on: a 401 alone cannot separate an
 * expired token from a wrong one, and a 403 alone cannot separate a token that cannot read
 * any domain from one that cannot read this domain. Status is the fallback for the refusals
 * the API leaves uncoded.
 */

/** Whether retrying the same request later is expected to succeed. */
export type ApiRefusalKind = "retryable" | "fatal"

export interface ApiRefusal {
  readonly kind: ApiRefusalKind
  /** The operator-facing message: names the fix, not the status line. */
  readonly message: string
}

/**
 * Printed for a 403 the API left uncoded: domain ownership is not verified yet, which is a
 * legitimate in-progress state that resolves on its own rather than a token fault.
 */
export const VERIFY_DOMAIN_MESSAGE =
  "Verifying domain ownership... this will only take a few minutes."

const TOKEN_EXPIRED_MESSAGE =
  "Your Appwarden API token has expired. Rotate it at https://use.appwarden.io?to=settings/security."
const TOKEN_CHECK_MESSAGE =
  "Authentication failed. Ensure your Appwarden API token is correct. Manage tokens at https://use.appwarden.io?to=settings/security."
const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Your Appwarden organization's subscription is not active. Check billing at https://use.appwarden.io?to=settings/billing."
const INSUFFICIENT_SCOPE_MESSAGE =
  "This Appwarden API token cannot read domains. Grant it the read:domains scope at https://use.appwarden.io?to=settings/security."
const DOMAIN_REQUIRED_MESSAGE =
  "The request did not name a domain. Pass an fqdn."
const DOMAIN_NOT_PERMITTED_MESSAGE =
  "This Appwarden API token is not permitted to read this domain. Widen the token's domain allowlist at https://use.appwarden.io?to=settings/security."

const fatal = (message: string): ApiRefusal => ({ kind: "fatal", message })
const retryable = (message: string): ApiRefusal => ({
  kind: "retryable",
  message,
})

/**
 * Maps an HTTP status and the API's `error.code` to a kind and a message.
 *
 * `code` is optional because a refusal from Cloudflare (a 502/504 HTML page) is not JSON
 * and carries no code; that classifies on its status instead.
 */
export const classifyApiRefusal = (
  status: number,
  code?: string | null,
): ApiRefusal => {
  if (status === 401) {
    return fatal(
      code === "TOKEN_EXPIRED" ? TOKEN_EXPIRED_MESSAGE : TOKEN_CHECK_MESSAGE,
    )
  }
  if (status === 402 && code === "SUBSCRIPTION_REQUIRED") {
    return fatal(SUBSCRIPTION_REQUIRED_MESSAGE)
  }
  if (status === 403) {
    if (code === "INSUFFICIENT_SCOPE") return fatal(INSUFFICIENT_SCOPE_MESSAGE)
    if (code === "DOMAIN_REQUIRED") return fatal(DOMAIN_REQUIRED_MESSAGE)
    if (code === "DOMAIN_NOT_PERMITTED") {
      return fatal(DOMAIN_NOT_PERMITTED_MESSAGE)
    }
    // No code: an unverified domain, not a token fault. It resolves on its own.
    if (!code) return retryable(VERIFY_DOMAIN_MESSAGE)
    // A code we do not recognise is still a token fault: only the uncoded 403 is the
    // transient unverified-domain state.
    return fatal(`The Appwarden API refused the request (HTTP ${status}).`)
  }
  if (status === 429) {
    return retryable(
      `The Appwarden API rate-limited the request (HTTP ${status}).`,
    )
  }
  if (status >= 500) {
    return retryable(
      `The Appwarden API is temporarily unavailable (HTTP ${status}).`,
    )
  }
  return fatal(`The Appwarden API refused the request (HTTP ${status}).`)
}

/**
 * Reads the API's `error.code` from a refusal body.
 *
 * A body that cannot be parsed classifies as its status rather than throwing inside the
 * classifier, so a non-JSON refusal still produces a message.
 */
export const readRefusalCode = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown }
    } | null
    const code = body?.error?.code
    return typeof code === "string" ? code : undefined
  } catch {
    return undefined
  }
}

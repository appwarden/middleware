import type { ApiRefusalKind } from "./api-refusal"

export interface ApiRefusalCase {
  readonly status: number
  /** The API's `error.code`; absent when the refusal carries no code. */
  readonly code?: string
  readonly kind: ApiRefusalKind
  readonly message: string
}

/**
 * The (status, code) pairs this change consumes, and the classification both call sites
 * must produce for each.
 *
 * The CLI and the runtime keep separate implementations — the CLI is a standalone CommonJS
 * file that cannot import from src/ — so this list is what keeps the two tables from
 * drifting apart: both test files drive it, and a divergence is a failing test.
 */
export const apiRefusalCases: readonly ApiRefusalCase[] = [
  {
    status: 400,
    kind: "fatal",
    message: "The Appwarden API refused the request (HTTP 400).",
  },
  {
    status: 401,
    kind: "fatal",
    message:
      "Authentication failed. Ensure your Appwarden API token is correct. Manage tokens at https://use.appwarden.io?to=settings/security.",
  },
  {
    status: 401,
    code: "TOKEN_EXPIRED",
    kind: "fatal",
    message:
      "Your Appwarden API token has expired. Rotate it at https://use.appwarden.io?to=settings/security.",
  },
  {
    status: 402,
    code: "SUBSCRIPTION_REQUIRED",
    kind: "fatal",
    message:
      "Your Appwarden organization's subscription is not active. Check billing at https://use.appwarden.io?to=settings/billing.",
  },
  {
    status: 403,
    code: "INSUFFICIENT_SCOPE",
    kind: "fatal",
    message:
      "This Appwarden API token cannot read domains. Grant it the read:domains scope at https://use.appwarden.io?to=settings/security.",
  },
  {
    status: 403,
    code: "DOMAIN_REQUIRED",
    kind: "fatal",
    message: "The request did not name a domain. Pass an fqdn.",
  },
  {
    status: 403,
    code: "DOMAIN_NOT_PERMITTED",
    kind: "fatal",
    message:
      "This Appwarden API token is not permitted to read this domain. Widen the token's domain allowlist at https://use.appwarden.io?to=settings/security.",
  },
  {
    status: 403,
    kind: "retryable",
    message: "Verifying domain ownership... this will only take a few minutes.",
  },
  {
    status: 404,
    kind: "fatal",
    message: "The Appwarden API refused the request (HTTP 404).",
  },
  {
    status: 422,
    kind: "fatal",
    message: "The Appwarden API refused the request (HTTP 422).",
  },
  {
    status: 429,
    kind: "retryable",
    message: "The Appwarden API rate-limited the request (HTTP 429).",
  },
  {
    status: 500,
    kind: "retryable",
    message: "The Appwarden API is temporarily unavailable (HTTP 500).",
  },
  {
    status: 503,
    kind: "retryable",
    message: "The Appwarden API is temporarily unavailable (HTTP 503).",
  },
]

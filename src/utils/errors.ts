import { ZodError, ZodInvalidReturnTypeIssue, ZodIssue } from "zod"

export enum SchemaErrorKey {
  DirectivesRequired = "DirectivesRequired",
  DirectivesBadParse = "DirectivesBadParse",
}

export enum AppwardenConfigErrorKey {
  AppwardenApiTokenMissing = "APPWARDEN_API_TOKEN_MISSING",
  NextJsNonceUnsupported = "NEXTJS_NONCE_UNSUPPORTED",
  VercelNonceUnsupported = "VERCEL_NONCE_UNSUPPORTED",
  AppwardenApiHostnameInvalidUrl = "APPWARDEN_API_HOSTNAME_INVALID_URL",
  AppwardenApiHostnameMustUseHttps = "APPWARDEN_API_HOSTNAME_MUST_USE_HTTPS",
  AppwardenApiHostnameMustBeAppwarden = "APPWARDEN_API_HOSTNAME_MUST_BE_APPWARDEN",
  LockPageSlugMustBeRelativePath = "LOCK_PAGE_SLUG_MUST_BE_RELATIVE_PATH",
  LockPageSlugRequired = "LOCK_PAGE_SLUG_REQUIRED",
  CspModeInvalid = "CSP_MODE_INVALID",
  CspDirectivesBadParse = "CSP_DIRECTIVES_BAD_PARSE",
  CspDirectivesRequired = "CSP_DIRECTIVES_REQUIRED",
  CacheUrlUnrecognized = "CACHE_URL_UNRECOGNIZED",
  CacheUrlInvalidEdgeConfig = "CACHE_URL_INVALID_EDGE_CONFIG",
  CacheUrlInvalidUpstash = "CACHE_URL_INVALID_UPSTASH",
  VercelApiTokenRequired = "VERCEL_API_TOKEN_REQUIRED",
  BooleanInvalid = "BOOLEAN_INVALID",
}

export const AppwardenConfigErrorMessages: Record<
  AppwardenConfigErrorKey,
  string
> = {
  [AppwardenConfigErrorKey.AppwardenApiTokenMissing]:
    "APPWARDEN_API_TOKEN is missing or empty. Learn more at https://appwarden.com/docs/guides/api-token-management.",
  [AppwardenConfigErrorKey.NextJsNonceUnsupported]:
    "Nonce-based CSP is not supported in the Next.js Cloudflare adapter. Remove '{{nonce}}' placeholders from your CSP directives, as this adapter does not inject nonces into HTML.",
  [AppwardenConfigErrorKey.VercelNonceUnsupported]:
    "Nonce-based CSP is not supported in Vercel Edge Middleware. Remove '{{nonce}}' placeholders from your CSP directives, as Vercel does not support nonce injection.",
  [AppwardenConfigErrorKey.AppwardenApiHostnameInvalidUrl]:
    "Invalid `appwardenApiHostname`. Please provide an absolute URL (e.g. https://api.appwarden.io).",
  [AppwardenConfigErrorKey.AppwardenApiHostnameMustUseHttps]:
    "`appwardenApiHostname` must use the https:// scheme (e.g. https://api.appwarden.io).",
  [AppwardenConfigErrorKey.AppwardenApiHostnameMustBeAppwarden]:
    "`appwardenApiHostname` must be https://api.appwarden.io or https://staging-api.appwarden.io.",
  [AppwardenConfigErrorKey.LockPageSlugMustBeRelativePath]:
    "lockPageSlug must be a relative path",
  [AppwardenConfigErrorKey.LockPageSlugRequired]:
    "lockPageSlug must be provided",
  [AppwardenConfigErrorKey.CspModeInvalid]:
    '`CSP_MODE` must be one of "disabled", "report-only", or "enforced"',
  [AppwardenConfigErrorKey.CspDirectivesBadParse]:
    "Failed to parse `CSP_DIRECTIVES`. Is it a valid JSON string?",
  [AppwardenConfigErrorKey.CspDirectivesRequired]:
    '`CSP_DIRECTIVES` must be provided when `CSP_MODE` is "report-only" or "enforced"',
  [AppwardenConfigErrorKey.CacheUrlUnrecognized]:
    "Provided `cacheUrl` is not recognized. Please provide a Vercel Edge Config or Upstash KV url.",
  [AppwardenConfigErrorKey.CacheUrlInvalidEdgeConfig]:
    "Provided Vercel Edge Config `cacheUrl` is not valid. It should be in the format https://edge-config.vercel.com/ecfg_*",
  [AppwardenConfigErrorKey.CacheUrlInvalidUpstash]:
    "Provided Upstash KV `cacheUrl` is not valid. It should be in the format rediss://:password@hostname.upstash.io:6379",
  [AppwardenConfigErrorKey.VercelApiTokenRequired]:
    "The `vercelApiToken` option is required when using Vercel Edge Config",
  [AppwardenConfigErrorKey.BooleanInvalid]:
    "Invalid value. Must be a boolean or one of 'true', 'false'.",
}

export type AppwardenIssueParams = {
  appwardenErrorKey?: string
}

export function getAppwardenErrorKey(
  issue: ZodIssue,
): AppwardenConfigErrorKey | undefined {
  const key = (issue as unknown as { params?: AppwardenIssueParams }).params
    ?.appwardenErrorKey
  if (
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(AppwardenConfigErrorMessages, key)
  ) {
    return key as AppwardenConfigErrorKey
  }
  return undefined
}

const errorsMap: Record<string, Record<string, string> | string> = {
  mode: AppwardenConfigErrorMessages[AppwardenConfigErrorKey.CspModeInvalid],
  directives: {
    [SchemaErrorKey.DirectivesRequired]:
      AppwardenConfigErrorMessages[
        AppwardenConfigErrorKey.CspDirectivesRequired
      ],
    [SchemaErrorKey.DirectivesBadParse]:
      AppwardenConfigErrorMessages[
        AppwardenConfigErrorKey.CspDirectivesBadParse
      ],
  },
  appwardenApiToken:
    AppwardenConfigErrorMessages[
      AppwardenConfigErrorKey.AppwardenApiTokenMissing
    ],
}

export const getErrors = (error: ZodError) => {
  const matches = new Set<string>()

  // Prefer explicit, stable keys emitted by schemas so callers can localize later.
  const collectKeyedMessages = (issues: ZodIssue[]) => {
    for (const issue of issues) {
      const key = getAppwardenErrorKey(issue)
      if (key) {
        matches.add(AppwardenConfigErrorMessages[key])
      }

      // we need to parse returnTypeError because we have a .returns() in the schema that contains errors
      // from schemas inside of middleware.before function
      if (
        "returnTypeError" in issue &&
        issue.returnTypeError &&
        Array.isArray(issue.returnTypeError.issues)
      ) {
        collectKeyedMessages(issue.returnTypeError.issues)
      }
    }
  }

  collectKeyedMessages(error.issues)

  // Legacy fallback for schemas that don't yet emit an explicit key.
  const errors = [...Object.entries(error.flatten().fieldErrors)]

  for (const issue of error.issues) {
    errors.push(
      ...Object.entries(
        "returnTypeError" in issue
          ? (issue as ZodInvalidReturnTypeIssue).returnTypeError.flatten()
              .fieldErrors
          : {},
      ),
    )
  }

  for (const [field, maybeSchemaErrorKey] of errors) {
    let match: string | Record<string, string> | undefined = errorsMap[field]
    if (match) {
      if (match instanceof Object) {
        if (maybeSchemaErrorKey) {
          match = match[maybeSchemaErrorKey[0]]
        } else {
          match = undefined
        }
      }

      if (typeof match === "string") {
        matches.add(match)
      }
    }
  }

  return [...matches]
}

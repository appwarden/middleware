import { ZodError, ZodInvalidReturnTypeIssue } from "zod"

export enum SchemaErrorKey {
  DirectivesRequired = "DirectivesRequired",
  DirectivesBadParse = "DirectivesBadParse",
}

export enum AppwardenConfigErrorKey {
  AppwardenApiTokenMissing = "APPWARDEN_API_TOKEN_MISSING",
  NextJsNonceUnsupported = "NEXTJS_NONCE_UNSUPPORTED",
  VercelNonceUnsupported = "VERCEL_NONCE_UNSUPPORTED",
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
}

const errorsMap: Record<string, Record<string, string> | string> = {
  mode: '`CSP_MODE` must be one of "disabled", "report-only", or "enforced"',
  directives: {
    [SchemaErrorKey.DirectivesRequired]:
      '`CSP_DIRECTIVES` must be provided when `CSP_MODE` is "report-only" or "enforced"',
    [SchemaErrorKey.DirectivesBadParse]:
      "Failed to parse `CSP_DIRECTIVES`. Is it a valid JSON string?",
  },
  appwardenApiToken:
    AppwardenConfigErrorMessages[
      AppwardenConfigErrorKey.AppwardenApiTokenMissing
    ],
}

export const getErrors = (error: ZodError) => {
  const matches = []
  const errors = [...Object.entries(error.flatten().fieldErrors)]

  // we need to parse returnTypeError because we have a .returns() in the schema that contains errors
  // from schemas inside of middleware.before function
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
    let match = errorsMap[field]
    if (match) {
      if (match instanceof Object) {
        if (maybeSchemaErrorKey) {
          match = match[maybeSchemaErrorKey[0]]
        }
      }

      matches.push(match)
    }
  }

  return matches
}

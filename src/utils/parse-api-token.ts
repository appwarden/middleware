/**
 * Dual-token API token format configuration.
 *
 * Kept dependency-free of `@appwarden/shared` so the middleware package can
 * validate tokens on its own.
 */
export const API_TOKEN_CONFIG = {
  PREFIX: "aw_",
  SEPARATOR: "_",
  PUBLIC_ID_LENGTH: 22,
  PUBLIC_ID_REGEX: /^[a-zA-Z0-9]+$/,
  SECRET_LENGTH: 43,
} as const

/**
 * Parse a dual-token API token into its public ID and secret.
 *
 * Only accepts the `aw_<publicId>_<secret>` format. Returns `undefined` for
 * legacy tokens or any malformed input.
 */
export function parseApiToken(
  token: string,
): { publicId: string; secret: string } | undefined {
  const {
    PREFIX,
    SEPARATOR,
    PUBLIC_ID_LENGTH,
    PUBLIC_ID_REGEX,
    SECRET_LENGTH,
  } = API_TOKEN_CONFIG

  const trimmedToken = token.trim()

  if (!trimmedToken.startsWith(PREFIX)) return undefined

  const withoutPrefix = trimmedToken.slice(PREFIX.length)
  const firstSeparatorIndex = withoutPrefix.indexOf(SEPARATOR)

  if (firstSeparatorIndex === -1 || firstSeparatorIndex === 0) return undefined

  const publicId = withoutPrefix.slice(0, firstSeparatorIndex)
  const secret = withoutPrefix.slice(firstSeparatorIndex + SEPARATOR.length)

  if (
    publicId.length !== PUBLIC_ID_LENGTH ||
    !PUBLIC_ID_REGEX.test(publicId) ||
    secret.length !== SECRET_LENGTH
  ) {
    return undefined
  }

  return { publicId, secret }
}

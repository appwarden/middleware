/**
 * CSP Keywords from W3C Content Security Policy Level 3 specification.
 * These keywords MUST be quoted in CSP headers (e.g., 'self' not self).
 *
 * @see https://www.w3.org/TR/CSP3/#grammardef-keyword-source
 */
export const CSP_KEYWORDS = [
  "self",
  "none",
  "unsafe-inline",
  "unsafe-eval",
  "unsafe-hashes",
  "strict-dynamic",
  "report-sample",
  "unsafe-allow-redirects",
  "wasm-unsafe-eval",
  "trusted-types-eval",
  "report-sha256",
  "report-sha384",
  "report-sha512",
  "unsafe-webtransport-hashes",
] as const

export type CSPKeyword = (typeof CSP_KEYWORDS)[number]

// Create a Set for O(1) lookup
const CSP_KEYWORDS_SET = new Set<string>(CSP_KEYWORDS)

/**
 * Checks if a value is a CSP keyword (case-insensitive).
 * Does not check for quotes - just the keyword itself.
 */
export const isCSPKeyword = (value: string): boolean => {
  return CSP_KEYWORDS_SET.has(value.toLowerCase())
}

/**
 * Checks if a value is already quoted (starts and ends with single quotes).
 */
export const isQuoted = (value: string): boolean => {
  return value.startsWith("'") && value.endsWith("'")
}

/**
 * Auto-quotes a CSP keyword if it's not already quoted.
 * Returns the value unchanged if:
 * - It's not a CSP keyword
 * - It's already quoted
 * - It's a nonce placeholder ({{nonce}})
 * - It's a hash value (sha256-..., sha384-..., sha512-...)
 *
 * This function is idempotent - calling it multiple times produces the same result.
 *
 * @example
 * autoQuoteCSPKeyword("self") // "'self'"
 * autoQuoteCSPKeyword("'self'") // "'self'" (already quoted)
 * autoQuoteCSPKeyword("https://example.com") // "https://example.com" (not a keyword)
 * autoQuoteCSPKeyword("{{nonce}}") // "{{nonce}}" (nonce placeholder)
 */
export const autoQuoteCSPKeyword = (value: string): string => {
  const trimmed = value.trim()

  // If already quoted (ignoring surrounding whitespace), return as-is
  if (isQuoted(trimmed)) {
    return trimmed
  }

  // If it's a CSP keyword (ignoring surrounding whitespace), quote the normalized keyword
  if (isCSPKeyword(trimmed)) {
    return `'${trimmed}'`
  }

  // Otherwise, return the trimmed value
  return trimmed
}

/**
 * Auto-quotes all CSP keywords in a space-separated string of directive values.
 *
 * @example
 * autoQuoteCSPDirectiveValue("self https://example.com") // "'self' https://example.com"
 * autoQuoteCSPDirectiveValue("'self' none") // "'self' 'none'"
 */
export const autoQuoteCSPDirectiveValue = (value: string): string => {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(autoQuoteCSPKeyword)
    .join(" ")
}

/**
 * Auto-quotes all CSP keywords in an array of directive values.
 *
 * @example
 * autoQuoteCSPDirectiveArray(["self", "https://example.com"]) // ["'self'", "https://example.com"]
 */
export const autoQuoteCSPDirectiveArray = (values: string[]): string[] => {
  return values.map(autoQuoteCSPKeyword)
}

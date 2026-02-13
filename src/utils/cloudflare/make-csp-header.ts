import { UseCSPInput } from "../../schemas"
import { ContentSecurityPolicyType } from "../../types"
import {
  autoQuoteCSPDirectiveArray,
  autoQuoteCSPDirectiveValue,
} from "./csp-keywords"

const addNonce = (value: string, cspNonce: string) =>
  value.replace("{{nonce}}", `'nonce-${cspNonce}'`)

export const makeCSPHeader = (
  cspNonce: string,
  directives: ContentSecurityPolicyType | undefined,
  mode: UseCSPInput["mode"],
) => {
  const namesSeen = new Set<string>(),
    result: string[] = []

  Object.entries(directives ?? {}).forEach(([originalName, value]) => {
    const name = originalName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()

    if (namesSeen.has(name)) {
      throw new Error(`${originalName} is specified more than once`)
    }

    namesSeen.add(name)

    // Normalize value to a string with auto-quoted CSP keywords
    let directiveValue: string
    if (Array.isArray(value)) {
      directiveValue = autoQuoteCSPDirectiveArray(value).join(" ")
    } else if (value === true) {
      directiveValue = ""
    } else if (typeof value === "string") {
      directiveValue = autoQuoteCSPDirectiveValue(value)
    } else {
      // value is false - skip this directive
      return
    }

    // Replace nonce placeholder once, at the end
    if (directiveValue) {
      result.push(`${name} ${addNonce(directiveValue, cspNonce)}`)
    } else {
      result.push(name)
    }
  })

  return [
    mode === "enforced"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    result.join("; "),
  ]
}

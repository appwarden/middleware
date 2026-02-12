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

    if (Array.isArray(value)) {
      // Auto-quote CSP keywords before joining
      value = addNonce(autoQuoteCSPDirectiveArray(value).join(" "), cspNonce)
    } else if (value === true) {
      value = ""
    } else if (typeof value === "string") {
      // Auto-quote CSP keywords in string values
      value = autoQuoteCSPDirectiveValue(value)
    }

    if (value) {
      result.push(`${name} ${addNonce(value, cspNonce)}`)
    } else if (value !== false) {
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

/**
 * Deep-merge helper for generated Appwarden configuration with call-site overrides.
 *
 * Shallow-merges top-level keys; for `contentSecurityPolicy`,
 * merges `mode` and `directives` separately.
 *
 * This is a pure function — call-sites pass their own loaded config.
 */
function toDirectiveRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function mergeAdapterConfig(
  generated: Record<string, unknown>,
  callSite: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...generated }

  for (const key of Object.keys(callSite)) {
    if (key === "contentSecurityPolicy") {
      if (callSite[key] === undefined) {
        continue
      }
      const genCsp = (generated[key] as Record<string, unknown>) || {}
      const siteCsp = (callSite[key] as Record<string, unknown>) || {}
      merged[key] = {
        mode: siteCsp.mode ?? genCsp.mode ?? undefined,
        directives: {
          ...toDirectiveRecord(genCsp.directives),
          ...toDirectiveRecord(siteCsp.directives),
        },
      }
    } else if (callSite[key] !== undefined) {
      merged[key] = callSite[key]
    }
  }

  return merged
}

/**
 * Merge generated config with call-site overrides and validate
 * through the provided schema parse function.
 */
export function parseMergedConfig<T>(
  generatedConfig: Record<string, unknown>,
  callSiteConfig: Record<string, unknown>,
  parseSchema: (input: unknown) => T,
): T {
  const merged = mergeAdapterConfig(generatedConfig, callSiteConfig)
  return parseSchema(merged)
}

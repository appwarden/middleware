/**
 * Deep-merge helper for generated Appwarden configuration with call-site overrides.
 *
 * Shallow-merges top-level keys; for `contentSecurityPolicy`,
 * merges `mode` and `directives` separately.
 *
 * This is a pure function — call-sites pass their own loaded config.
 */
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
          ...((genCsp.directives as Record<string, unknown>) || {}),
          ...((siteCsp.directives as Record<string, unknown>) || {}),
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

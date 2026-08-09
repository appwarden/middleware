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
      throw new Error("contentSecurityPolicy.directives must be valid JSON")
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
 * Converts a route-based Appwarden middleware configuration into the flat
 * adapter configuration shape. Framework adapters consume a single lock page
 * slug and a single CSP configuration, so we pick the first middleware entry
 * that has a website configuration, falling back to the first entry if none
 * has one.
 *
 * @param generated - Generated config from `appwarden-link`
 * @returns Flat config ready for adapter schema validation
 */
export function normalizeRouteBasedAdapterConfig(
  generated: Record<string, unknown>,
): Record<string, unknown> {
  if (
    !Array.isArray(generated.appwardenMiddleware) ||
    generated.appwardenMiddleware.length === 0
  ) {
    return generated
  }

  const middleware = generated.appwardenMiddleware as Array<
    Record<string, unknown>
  >

  const entry =
    middleware.find((entry) => {
      const options = entry.options
      return (
        typeof options === "object" &&
        options !== null &&
        (options as Record<string, unknown>).website !== undefined
      )
    }) ?? middleware[0]

  const options = entry?.options as Record<string, unknown> | undefined
  const website = options?.website as Record<string, unknown> | undefined

  const normalized: Record<string, unknown> = { ...generated }
  delete normalized.appwardenMiddleware

  if (website?.lockPageSlug !== undefined) {
    normalized.lockPageSlug = website.lockPageSlug
  }

  if (website?.cspMode !== undefined && website?.cspDirectives !== undefined) {
    normalized.contentSecurityPolicy = {
      mode: website.cspMode,
      directives: website.cspDirectives,
    }
  }

  if (options?.debug !== undefined) {
    normalized.debug = options.debug
  }

  return normalized
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

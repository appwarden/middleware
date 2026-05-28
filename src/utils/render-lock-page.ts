import { normalizeLockPageSlug } from "./build-lock-page-url"

/**
 * Context required for rendering the lock page.
 * This is a minimal interface that only includes what's needed.
 */
export interface RenderLockPageContext {
  /** The slug/path of the lock page to render */
  lockPageSlug: string
  /** The request URL (used to determine the origin) */
  requestUrl: URL
}

export const renderLockPage = async (context: RenderLockPageContext) => {
  let normalizedSlug: string
  try {
    normalizedSlug = normalizeLockPageSlug(context.lockPageSlug)
  } catch {
    throw new Error("lockPageSlug must be a relative path")
  }
  const url = new URL(normalizedSlug, context.requestUrl.origin)
  return fetch(url, {
    headers: {
      // no browser caching, otherwise we need to hard refresh to disable lock screen
      "Cache-Control": "no-store",
    },
  })
}

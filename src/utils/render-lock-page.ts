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
  const url = new URL(context.lockPageSlug, context.requestUrl.origin)
  if (url.origin !== context.requestUrl.origin) {
    throw new Error("lockPageSlug must be a relative path")
  }
  return fetch(url, {
    headers: {
      // no browser caching, otherwise we need to hard refresh to disable lock screen
      "Cache-Control": "no-store",
    },
  })
}

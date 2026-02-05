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

export const renderLockPage = (context: RenderLockPageContext) =>
  fetch(new URL(context.lockPageSlug, context.requestUrl.origin), {
    headers: {
      // no browser caching, otherwise we need to hard refresh to disable lock screen
      "Cache-Control": "no-store",
    },
  })

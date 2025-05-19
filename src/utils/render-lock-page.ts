import { CloudflareProviderContext } from "../types/cloudflare"

export const renderLockPage = (context: CloudflareProviderContext) =>
  fetch(new URL(context.lockPageSlug, context.requestUrl.origin), {
    headers: {
      // no browser caching, otherwise we need to hard refresh to disable lock screen
      "Cache-Control": "no-store",
    },
  })

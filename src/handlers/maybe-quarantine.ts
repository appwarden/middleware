import { checkLockStatus } from "../core"
import { CloudflareProviderContext } from "../types"

/**
 * Checks if the site is locked and calls the onLocked callback if so.
 *
 * This function delegates to checkLockStatus from the core module for the actual
 * lock status resolution, providing a callback-based API for middleware that needs
 * to perform actions when the site is locked.
 *
 * @param context - The Cloudflare provider context containing request and config
 * @param options - Options object with onLocked callback
 */
export const maybeQuarantine = async (
  context: CloudflareProviderContext,
  options: {
    onLocked: () => Promise<void>
  },
) => {
  const result = await checkLockStatus({
    request: context.request,
    appwardenApiToken: context.appwardenApiToken,
    appwardenApiHostname: context.appwardenApiHostname,
    debug: context.debug,
    lockPageSlug: context.lockPageSlug,
    waitUntil: context.waitUntil,
  })

  if (result.isLocked) {
    await options.onLocked()
  }
}

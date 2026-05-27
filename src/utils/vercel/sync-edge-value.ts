import { APPWARDEN_MIDDLEWARE_USER_AGENT } from "../../constants"
import { AppwardenApiHostnameSchema } from "../../schemas"
import { VercelProviderContext } from "../../types"
import { printMessage } from "../print-message"

class APIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "APIError"
  }
}

const API_TIMEOUT_MS = 10_000

function resolveApiHostname(hostname: string | undefined): string {
  if (!hostname) {
    // @ts-expect-error config variables
    return API_HOSTNAME
  }
  const parsed = AppwardenApiHostnameSchema.safeParse(hostname)
  if (!parsed.success) {
    // @ts-expect-error config variables
    return API_HOSTNAME
  }
  return parsed.data
}

export const syncEdgeValue = async (
  context: Pick<
    VercelProviderContext,
    | "cacheUrl"
    | "requestUrl"
    | "vercelApiToken"
    | "appwardenApiToken"
    | "appwardenApiHostname"
    | "debug"
  >,
) => {
  // we use this log to search vercel logs during testing (see packages/appwarden-vercel/edge-cache-testing-results.md)
  context.debug("syncing with api")

  const apiHostname = resolveApiHostname(context.appwardenApiHostname)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    // @ts-expect-error config variables
    const response = await fetch(new URL(API_PATHNAME, apiHostname), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": APPWARDEN_MIDDLEWARE_USER_AGENT,
      },
      body: JSON.stringify({
        service: "vercel",
        cacheUrl: context.cacheUrl,
        fqdn: context.requestUrl.hostname,
        vercelApiToken: context.vercelApiToken ?? "",
        appwardenApiToken: context.appwardenApiToken,
      }),
      signal: controller.signal,
    })

    // If the check endpoint returns 403, log a domain verification message
    if (response.status === 403) {
      console.log(
        printMessage(
          "Verifying domain ownership... this will only take a few minutes.",
        ),
      )
    }

    if (response.status !== 200) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    if (response.headers.get("content-type")?.includes("application/json")) {
      const result = await response.json<{ error?: { message: string } }>()
      if (result.error) {
        throw new APIError(result.error.message)
      }
    }
  } catch (e) {
    const message = "Failed to fetch from check endpoint"

    console.error(
      printMessage(
        e instanceof APIError
          ? e.message
          : e instanceof Error
            ? `${message} - ${e.message}`
            : message,
      ),
    )
  } finally {
    clearTimeout(timeout)
  }
}

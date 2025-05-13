import { VercelProviderContext } from "../../types"
import { debug } from "../debug"
import { printMessage } from "../print-message"

class APIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "APIError"
  }
}

export const syncEdgeValue = async (context: VercelProviderContext) => {
  // we use this log to search vercel logs during testing (see packages/appwarden-vercel/edge-cache-testing-results.md)
  debug(`syncing with api`)

  try {
    // @ts-expect-error config variables
    const response = await fetch(new URL(API_PATHNAME, API_HOSTNAME), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service: "vercel",
        cacheUrl: context.cacheUrl,
        fqdn: context.requestUrl.hostname,
        vercelApiToken: context.vercelApiToken ?? "",
        appwardenApiToken: context.appwardenApiToken,
      }),
    })

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
  }
}

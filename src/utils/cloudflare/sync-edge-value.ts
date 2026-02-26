import { LockValue, LockValueType } from "../../schemas"
import { CloudflareProviderContext } from "../../types/cloudflare"
import { printMessage } from "../print-message"

class APIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "APIError"
  }
}

const DEFAULT_API_HOSTNAME = "https://api.appwarden.io"

export const syncEdgeValue = async (context: CloudflareProviderContext) => {
  // Use runtime-configured hostname if provided, otherwise fall back to default
  const apiHostname = context.appwardenApiHostname ?? DEFAULT_API_HOSTNAME
  context.debug(`GET ${apiHostname}`)

  try {
    // @ts-expect-error API_PATHNAME is a build-time config variable
    const response = await fetch(new URL(API_PATHNAME, apiHostname), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service: "cloudflare",
        provider: context.provider,
        fqdn: context.requestUrl.hostname,
        appwardenApiToken: context.appwardenApiToken,
      }),
    })

    if (response.status !== 200) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      const result = await response.json<{
        content: LockValueType
        error: { message: string }
      }>()

      if (result.error) {
        throw new APIError(result.error.message)
      }

      if (!result.content) {
        throw new APIError("no content from api")
      }

      try {
        const parsedValue = LockValue.omit({ lastCheck: true }).parse(
          result.content,
        )
        context.debug(`GET ${apiHostname} succeeded`)

        await context.edgeCache.updateValue({
          ...parsedValue,
          lastCheck: Date.now(),
        })
      } catch (error) {
        throw new APIError(`Failed to parse check endpoint result - ${error}`)
      }
    }
  } catch (e) {
    const message = `GET ${apiHostname} failed`

    console.error(
      printMessage(
        e instanceof APIError
          ? e.message
          : e instanceof Error
            ? `${message}: ${e.message}`
            : message,
      ),
    )
  }
}

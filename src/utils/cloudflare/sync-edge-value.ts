import { APPWARDEN_MIDDLEWARE_USER_AGENT } from "../../constants"
import {
  AppwardenApiHostnameSchema,
  LockValue,
  LockValueType,
} from "../../schemas"
import { CloudflareProviderContext } from "../../types/cloudflare"
import { printMessage } from "../print-message"

class APIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "APIError"
  }
}

const DEFAULT_API_HOSTNAME = "https://api.appwarden.io"
const API_TIMEOUT_MS = 10_000

function resolveApiHostname(hostname: string | undefined): string {
  if (!hostname) return DEFAULT_API_HOSTNAME
  const parsed = AppwardenApiHostnameSchema.safeParse(hostname)
  if (!parsed.success) return DEFAULT_API_HOSTNAME
  return parsed.data
}

export const syncEdgeValue = async (context: CloudflareProviderContext) => {
  // Use runtime-configured hostname if provided and valid, otherwise fall back to default
  const apiHostname = resolveApiHostname(context.appwardenApiHostname)
  context.debug(`GET ${apiHostname}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    // @ts-expect-error API_PATHNAME is a build-time config variable
    const response = await fetch(new URL(API_PATHNAME, apiHostname), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": APPWARDEN_MIDDLEWARE_USER_AGENT,
      },
      body: JSON.stringify({
        service: "cloudflare",
        provider: context.provider,
        fqdn: context.requestUrl.hostname,
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
  } finally {
    clearTimeout(timeout)
  }
}

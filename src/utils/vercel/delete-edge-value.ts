import { VercelProviderContext } from "../../types"
import { getEdgeConfigId } from "../is-cache-url"
import { printMessage } from "../print-message"

export const deleteEdgeValue = async ({
  keyName,
  provider,
  cacheUrl,
  vercelApiToken,
}: VercelProviderContext) => {
  try {
    switch (provider) {
      case "edge-config": {
        const edgeConfigId = getEdgeConfigId(cacheUrl)
        if (!edgeConfigId) {
          throw new Error("Failed to parse `edgeConfigId`")
        }

        const res = await fetch(
          `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${vercelApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              items: [
                {
                  key: keyName,
                  operation: "delete",
                },
              ],
            }),
          },
        )
        if (res.status !== 200) {
          let response: { error: { message: string } } | undefined = undefined
          try {
            response = await res.json()
          } catch (error) {}

          throw new Error(
            `api.vercel.com/v1/edge-config responded with ${res.status} - ${
              res.statusText
            }${
              response?.error?.message ? ` - ${response?.error?.message}` : ""
            }`,
          )
        }
        break
      }
      case "upstash": {
        const { hostname, password } = new URL(cacheUrl)
        const { Redis } = await import("@upstash/redis")
        // Pinned for the same reason as `get-lock-value.ts`: @upstash/redis 1.40.0 flipped
        // the default from "base64" to false, so the wire format is a decision here rather
        // than something an SDK bump can change.
        const redis = new Redis({
          url: `https://${hostname}`,
          token: password,
          responseEncoding: false,
        })
        await redis.del(keyName)
        break
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  } catch (e) {
    const message = "Failed to delete edge value"
    console.error(
      printMessage(e instanceof Error ? `${message} - ${e.message}` : message),
    )
  }
}

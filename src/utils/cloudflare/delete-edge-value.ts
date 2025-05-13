import { CloudflareProviderContext } from "../../types"
import { printMessage } from "../print-message"

export const deleteEdgeValue = async (context: CloudflareProviderContext) => {
  try {
    switch (context.provider) {
      case "cloudflare-cache": {
        const success = await context.edgeCache.deleteValue()
        if (!success) {
          throw new Error()
        }

        break
      }
      default:
        throw new Error(`Unsupported provider: ${context.provider}`)
    }
  } catch (e) {
    const message = "Failed to delete edge value"
    console.error(
      printMessage(e instanceof Error ? `${message} - ${e.message}` : message),
    )
  }
}

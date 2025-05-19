import { Response } from "@cloudflare/workers-types"
import { LockValue, LockValueType } from "../../schemas"
import { CloudflareProviderContext } from "../../types"
import { printMessage } from "../print-message"

export const getLockValue = async (
  context: Pick<
    CloudflareProviderContext,
    "edgeCache" | "provider" | "keyName"
  >,
) => {
  try {
    let shouldDeleteEdgeValue = false
    let cacheResponse: Response | undefined,
      lockValue: LockValueType = {
        isLocked: 0,
        isLockedTest: 0,
        lastCheck: Date.now(),
        code: "",
      }

    switch (context.provider) {
      case "cloudflare-cache": {
        cacheResponse = await context.edgeCache.getValue()

        break
      }
      default:
        throw new Error(`Unsupported provider: ${context.provider}`)
    }

    if (!cacheResponse) {
      return { lockValue: undefined }
    }

    try {
      const clonedResponse = cacheResponse?.clone()
      lockValue = LockValue.parse(
        clonedResponse ? await clonedResponse.json() : undefined,
      )
    } catch (error) {
      console.error(
        printMessage(
          `Failed to parse ${context.keyName} from edge cache - ${error}`,
        ),
      )
      shouldDeleteEdgeValue = true
    }

    return { lockValue, shouldDeleteEdgeValue }
  } catch (e) {
    const message = "Failed to retrieve edge value"
    console.error(
      printMessage(e instanceof Error ? `${message} - ${e.message}` : message),
    )

    return { lockValue: undefined }
  }
}

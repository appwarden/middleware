import { errors } from "../../constants"
import { LockValue, LockValueType } from "../../schemas"
import { VercelProviderContext } from "../../types"
import { printMessage } from "../print-message"

export const getLockValue = async (
  context: Pick<VercelProviderContext, "cacheUrl" | "keyName" | "provider">,
) => {
  try {
    let shouldDeleteEdgeValue = false
    let serializedValue: LockValueType | string | undefined,
      lockValue: LockValueType = {
        isLocked: 0,
        isLockedTest: 0,
        lastCheck: 0,
        code: "",
      }

    switch (context.provider) {
      case "edge-config": {
        const { createClient } = await import("@vercel/edge-config")
        const edgeConfig = createClient(context.cacheUrl)

        serializedValue = await edgeConfig.get<string | undefined>(
          context.keyName,
        )

        break
      }
      case "upstash": {
        const { hostname, password } = new URL(context.cacheUrl)
        const { Redis } = await import("@upstash/redis")
        const redis = new Redis({
          url: `https://${hostname}`,
          token: password,
        })

        const redisValue = await redis.get<LockValueType | null>(
          context.keyName,
        )
        serializedValue = redisValue === null ? undefined : redisValue

        break
      }
      default:
        throw new Error(`Unsupported provider: ${context.provider}`)
    }

    if (!serializedValue) {
      return { lockValue: undefined }
    }

    try {
      lockValue = LockValue.parse(
        typeof serializedValue === "string"
          ? JSON.parse(serializedValue)
          : serializedValue,
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

    if (e instanceof Error) {
      if (e.message.includes("Invalid connection string provided")) {
        throw new Error(errors.badCacheConnection)
      }
    }

    return { lockValue: undefined }
  }
}

import { printMessage } from "./print-message"

export const debug =
  (isDebug: boolean) =>
  (...msg: any[]) => {
    if (!isDebug) return

    const parts = msg.map((m) => {
      let content: string

      if (m instanceof Error) {
        // Prefer stack trace when available, fall back to message
        content = m.stack ?? m.message
      } else if (typeof m === "object" && m !== null) {
        // Objects are JSON stringified for readability in logs
        try {
          content = JSON.stringify(m)
        } catch {
          // Handle circular references, BigInt, etc.
          try {
            content = String(m)
          } catch {
            content = "[Unserializable value]"
          }
        }
      } else {
        // Primitives (string, number, boolean, etc.)
        content = String(m)
      }

      return content
    })

    const message = parts.join(" ")

    console.log(printMessage(message))
  }

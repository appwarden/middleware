export const debug = (...msg: any[]) => {
  // @ts-expect-error config variables
  if (DEBUG) {
    const formatted = msg.map((m) => {
      if (typeof m === "object" && m !== null) {
        // Handle Error objects specially - JSON.stringify returns "{}" for them
        if (m instanceof Error) {
          return m.stack ?? m.message
        }
        try {
          return JSON.stringify(m)
        } catch {
          // Handle circular references, BigInt, etc.
          try {
            return String(m)
          } catch {
            return "[Unserializable value]"
          }
        }
      }
      return m
    })
    console.log(...formatted)
  }
}

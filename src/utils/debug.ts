export const debug = (...msg: any[]) => {
  // @ts-expect-error config variables
  if (DEBUG) {
    const formatted = msg.map((m) => {
      if (typeof m === "object" && m !== null) {
        try {
          return JSON.stringify(m)
        } catch {
          if (m instanceof Error) {
            return m.stack || m.message || String(m)
          }
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

export const debug = (...msg: any[]) => {
  // @ts-expect-error config variables
  if (DEBUG) {
    const formatted = msg.map((m) =>
      typeof m === "object" && m !== null ? JSON.stringify(m) : m,
    )
    console.log(...formatted)
  }
}

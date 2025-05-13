export const debug = (...msg: any[]) => {
  // @ts-expect-error config variables
  if (DEBUG) {
    console.log(...msg)
  }
}

export const getNowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

export const getElapsedMs = (startTime: number) =>
  Math.round(getNowMs() - startTime)

export const logElapsed = (
  debug: (message: string) => void,
  startTime: number,
) => {
  debug(`Middleware executed in ${getElapsedMs(startTime)}ms`)
}

import { MiddlewareOptionsType } from "../schemas/middleware-options"

const normalizePathPattern = (pattern: string): string => {
  if (pattern.endsWith("/*")) {
    return pattern.slice(0, -2)
  }
  return pattern
}

export const matchesSegmentBoundaryPath = (
  requestPath: string,
  pattern: string,
): boolean => {
  const normalized = normalizePathPattern(pattern)

  if (normalized === requestPath) {
    return true
  }

  return requestPath.startsWith(`${normalized}/`)
}

export const matchesAnyPath = (
  requestPath: string,
  patterns?: string[],
): boolean => {
  if (!patterns || patterns.length === 0) {
    return false
  }

  return patterns.some((pattern) =>
    matchesSegmentBoundaryPath(requestPath, pattern),
  )
}

export const resolveMiddlewareAction = (
  request: Request,
  options: MiddlewareOptionsType,
): "bypass" | "api" | "website" | null => {
  const requestPath = new URL(request.url).pathname

  if (matchesAnyPath(requestPath, options.bypassPaths)) {
    return "bypass"
  }

  if (matchesAnyPath(requestPath, options.api?.basePaths)) {
    return "api"
  }

  if (options.website) {
    return "website"
  }

  return null
}

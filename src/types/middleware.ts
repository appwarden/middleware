import { z } from "zod"

export interface MiddlewareContext {
  hostname: string
  request: Request
  response: Response
  waitUntil: ExecutionContext["waitUntil"]
}

export type Middleware = (
  context: MiddlewareContext,
  next: () => MiddlewareNextSchemaType,
) => MiddlewareNextSchemaType

export interface Pipeline {
  execute: (context: MiddlewareContext) => Promise<void | null>
}

export const MiddlewareNextSchema = z.union([
  z.void(),
  z.null(),
  z.promise(z.union([z.void(), z.null()])),
])

export type MiddlewareNextSchemaType = z.infer<typeof MiddlewareNextSchema>

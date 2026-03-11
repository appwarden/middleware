import { useContentSecurityPolicy } from "../middlewares"
import type { UseCSPInput } from "../schemas"
import type { MiddlewareContext } from "../types"

interface ApplyContentSecurityPolicyToResponseOptions extends MiddlewareContext {
  contentSecurityPolicy: UseCSPInput
}

export const applyContentSecurityPolicyToResponse = async ({
  contentSecurityPolicy,
  ...context
}: ApplyContentSecurityPolicyToResponseOptions): Promise<Response> => {
  await useContentSecurityPolicy(contentSecurityPolicy)(context, async () => {})
  return context.response
}

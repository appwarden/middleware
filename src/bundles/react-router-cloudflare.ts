export {
  createAppwardenMiddleware,
  type ReactRouterConfigFn,
  type ReactRouterMiddlewareArgs,
  type ReactRouterMiddlewareFunction,
} from "../adapters/react-router-cloudflare"

// Re-export config types from schema for convenience
export type {
  ReactRouterAppwardenConfigInput,
  ReactRouterCloudflareConfig,
} from "../schemas/react-router-cloudflare"

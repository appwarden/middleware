# React Router Middleware Adapter Proposal

## Summary

This proposal introduces a new Appwarden middleware variant specifically designed to be compatible with React Router's native middleware system. This enables Appwarden to be mounted as route-level middleware rather than wrapping the entire Worker, providing a cleaner integration that follows React Router idioms.

## Problem Statement

Currently, Appwarden provides `withAppwarden` (alias for `appwardenOnCloudflare`) which:

1. Takes a config function and returns a **complete fetch handler**
2. Internally runs the entire request pipeline including `useFetchOrigin()` to proxy to the origin
3. Is designed for the "Standalone Middleware" strategy where Appwarden sits in front of an origin

This architecture doesn't fit React Router's native middleware system, which expects middleware to:

1. Receive `(args, next)` where `args` contains `request`, `params`, and `context`
2. Call `next()` to continue the middleware chain
3. Return a result or throw a `Response` for redirects/rewrites

## React Router Middleware Signature

From [React Router's source code](https://github.com/remix-run/react-router/blob/main/packages/react-router/lib/router/utils.ts):

```typescript
interface MiddlewareNextFunction<Result = unknown> {
  (): Promise<Result>
}

type MiddlewareFunction<Result = unknown> = (
  args: DataFunctionArgs<Readonly<RouterContextProvider>>,
  next: MiddlewareNextFunction<Result>,
) => MaybePromise<Result | void>

interface DataFunctionArgs<Context> {
  request: Request
  unstable_pattern: string
  params: Params
  context: Context
}
```

## Proposed Solution

### New Export: `createAppwardenMiddleware`

Create a factory function that returns a React Router-compatible middleware:

```typescript
// src/adapters/react-router.ts
import type { MiddlewareFunction } from "react-router"

export interface ReactRouterAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
}

export type ReactRouterConfigFn = (cloudflare: {
  env: CloudflareEnv
  ctx: ExecutionContext
}) => ReactRouterAppwardenConfig

export function createAppwardenMiddleware(
  configFn: ReactRouterConfigFn,
): MiddlewareFunction {
  return async ({ request, context }, next) => {
    // 1. Extract Cloudflare context from React Router context
    const cloudflare = context.get(cloudflareContext) // or access via context.cloudflare
    const config = configFn(cloudflare)

    // 2. Check lock status using core Appwarden logic
    const isLocked = await checkLockStatus({
      request,
      appwardenApiToken: config.appwardenApiToken,
      appwardenApiHostname: config.appwardenApiHostname,
      debug: config.debug,
    })

    // 3. If locked, throw redirect to lock page
    if (isLocked) {
      throw redirect(config.lockPageSlug)
    }

    // 4. Otherwise, continue to next middleware/loader
    return next()
  }
}
```

### Usage in React Router

Users would add this to their root route or a `$.tsx` splat route:

```typescript
// app/routes.ts or app/routes/$.tsx
import { createAppwardenMiddleware } from "@appwarden/middleware/react-router"

export const unstable_middleware = [
  createAppwardenMiddleware(({ env }) => ({
    lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
    appwardenApiToken: env.APPWARDEN_API_TOKEN,
  })),
]
```

### Architecture Changes

#### 1. Extract Core Lock-Checking Logic

Refactor `maybeQuarantine` and related functions into a framework-agnostic core:

```typescript
// src/core/check-lock-status.ts
export interface CheckLockConfig {
  request: Request
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
  waitUntil?: (fn: Promise<unknown>) => void
}

export async function checkLockStatus(
  config: CheckLockConfig,
): Promise<boolean> {
  // Core lock-checking logic extracted from useAppwarden
  // Uses edge cache, syncs values, returns boolean
}
```

#### 2. New Bundle Entry Point

```typescript
// src/bundles/react-router.ts
export { createAppwardenMiddleware } from "../adapters/react-router"
export type {
  ReactRouterAppwardenConfig,
  ReactRouterConfigFn,
} from "../adapters/react-router"
```

#### 3. Package.json Export

```json
{
  "exports": {
    "./react-router": {
      "types": "./dist/bundles/react-router.d.ts",
      "import": "./dist/bundles/react-router.js"
    }
  }
}
```

## Key Differences from Current Implementation

| Aspect             | Current `withAppwarden`               | Proposed `createAppwardenMiddleware`   |
| ------------------ | ------------------------------------- | -------------------------------------- |
| Returns            | Fetch handler                         | Middleware function                    |
| Origin fetching    | Built-in (`useFetchOrigin`)           | Not included (React Router handles)    |
| Lock page          | Renders directly via `renderLockPage` | Throws `redirect()` to lock page route |
| Runs               | Before origin                         | Within React Router's middleware chain |
| Content-Type check | Checks for `text/html`                | Runs on all matched routes             |

## Implementation Considerations

### 1. Cloudflare Context Access

React Router on Cloudflare passes cloudflare context via the request handler:

```typescript
// workers/app.ts
export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    })
  },
}
```

The middleware needs to access `env` for configuration. Options:

- Access via `args.context` (React Router's RouterContextProvider)
- Create a React Router context with `createContext()` from React Router

### 2. Edge Cache Access

The current implementation relies on `caches.open("appwarden:lock")` which is available globally in Workers. This should work the same way in the React Router middleware context.

### 3. waitUntil Support

React Router middleware may not have direct access to `ctx.waitUntil`. We need to:

- Pass it via the Cloudflare context
- Or use the global `ctx` if available in the middleware scope

### 4. Lock Page as a Route

Instead of fetching and rendering the lock page directly, the middleware throws a `redirect()` to the lock page slug. This means:

- The lock page must be a valid React Router route
- Users need to create a route like `app/routes/maintenance.tsx`

## Alternative: Lock Page Rewrite

Instead of redirecting, we could rewrite the response:

```typescript
if (isLocked) {
  // Rewrite to lock page without changing URL
  throw new Response(null, {
    status: 200,
    headers: {
      "X-Appwarden-Rewrite": config.lockPageSlug,
    },
  })
}
```

This would require custom handling in the Worker entry, making it less clean.

## Open Questions

1. **Should we support both redirect and rewrite?** Some users may want the URL to change, others may want it to stay the same.

2. **How to handle non-HTML requests?** The current implementation only runs for `text/html` responses. In the middleware approach, we'd run before the response is generated. Should we check `Accept` headers?

3. **Multi-domain support?** The current implementation supports `multidomainConfig`. How should this work with React Router's routing?

4. **Testing strategy?** React Router middleware is relatively new. What's the best way to test this integration?

## Timeline Estimate

- **Phase 1**: Extract core lock-checking logic (2-3 days)
- **Phase 2**: Implement React Router adapter (2-3 days)
- **Phase 3**: Update documentation (1-2 days)
- **Phase 4**: Testing and refinement (2-3 days)

**Total**: ~8-11 days

## References

- [React Router Middleware Documentation](https://reactrouter.com/how-to/middleware)
- [React Router Cloudflare Deployment](https://reactrouter.com/how-to/cloudflare)
- [React Router Source - MiddlewareFunction type](https://github.com/remix-run/react-router/blob/main/packages/react-router/lib/router/utils.ts)

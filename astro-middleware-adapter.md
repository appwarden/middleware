# Astro Middleware Adapter Proposal

## Summary

This proposal introduces a new Appwarden middleware variant specifically designed to be compatible with Astro's native middleware system. This enables Appwarden to be mounted as server-side middleware rather than wrapping the entire Worker entry, providing a cleaner integration that follows Astro idioms.

## Problem Statement

Currently, the Astro integration documented in `websites/appwarden-io/content/docs/300-guides/210-astro-cloudflare.mdx` describes a **worker entry file approach** that:

1. Creates a custom `src/worker.ts` that wraps the Astro handler with `withAppwarden`
2. Requires modifying `wrangler.jsonc` to use the custom worker entry
3. Uses the Cloudflare-specific `withAppwarden` which runs a full pipeline including origin fetching

This architecture doesn't align with Astro's native middleware system, which expects middleware to:

1. Be defined in `src/middleware.ts` (or `src/middleware/index.ts`)
2. Export an `onRequest` function that receives `(context, next)`
3. Call `next()` to continue the middleware chain
4. Return a `Response` or the result of `next()`

## Astro Middleware Signature

From [Astro's Middleware Documentation](https://docs.astro.build/en/guides/middleware/):

```typescript
import { defineMiddleware } from "astro:middleware"

export const onRequest = defineMiddleware((context, next) => {
  // intercept data from a request
  // optionally, modify the properties in `locals`
  context.locals.title = "New title"

  // return a Response or the result of calling `next()`
  return next()
})
```

The `context` object includes:

- `request`: The incoming `Request` object
- `locals`: An object for storing request-specific data
- `redirect(path, status?)`: Helper to create redirect responses
- `rewrite(path)`: Helper to rewrite to a different route

On Cloudflare, the runtime context is available via `context.locals.runtime`:

```typescript
interface AstroLocals {
  runtime: {
    env: CloudflareEnv
    ctx: ExecutionContext
  }
}
```

## Proposed Solution

### New Export: `createAppwardenMiddleware`

Create a factory function that returns an Astro-compatible middleware:

```typescript
// src/adapters/astro.ts
export interface AstroAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
}

export type AstroConfigFn = (runtime: {
  env: CloudflareEnv
  ctx: ExecutionContext
}) => AstroAppwardenConfig

export function createAppwardenMiddleware(
  configFn: AstroConfigFn,
): AstroMiddlewareFunction {
  return async (context, next) => {
    // 1. Extract Cloudflare runtime from Astro locals
    const runtime = context.locals.runtime
    if (!runtime) {
      console.error("[Appwarden] Cloudflare runtime not found")
      return next()
    }

    const config = configFn(runtime)

    // 2. Check lock status using core Appwarden logic
    const result = await checkLockStatus({
      request: context.request,
      appwardenApiToken: config.appwardenApiToken,
      appwardenApiHostname: config.appwardenApiHostname,
      debug: config.debug,
      lockPageSlug: config.lockPageSlug,
      waitUntil: (fn) => runtime.ctx.waitUntil(fn),
    })

    // 3. If locked, redirect to lock page
    if (result.isLocked) {
      return context.redirect(config.lockPageSlug, 302)
    }

    // 4. Otherwise, continue to next middleware/route
    return next()
  }
}
```

### Usage in Astro

Users would add this to their middleware file:

```typescript
// src/middleware.ts
import { sequence } from "astro:middleware"
import { createAppwardenMiddleware } from "@appwarden/middleware/astro"

const appwarden = createAppwardenMiddleware(({ env }) => ({
  lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
  appwardenApiToken: env.APPWARDEN_API_TOKEN,
}))

export const onRequest = sequence(appwarden)
```

### Architecture Changes

#### 1. New Adapter File

```typescript
// src/adapters/astro.ts
import { APPWARDEN_USER_AGENT } from "../constants"
import { checkLockStatus } from "../core"
import { printMessage } from "../utils"

export interface AstroCloudflareRuntime {
  env: CloudflareEnv
  ctx: ExecutionContext
}

export interface AstroAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
}

export type AstroConfigFn = (
  runtime: AstroCloudflareRuntime,
) => AstroAppwardenConfig

export interface AstroMiddlewareContext {
  request: Request
  locals: {
    runtime?: AstroCloudflareRuntime
    [key: string]: unknown
  }
  redirect: (path: string, status?: number) => Response
}

export type AstroMiddlewareFunction = (
  context: AstroMiddlewareContext,
  next: () => Promise<Response>,
) => Promise<Response>

export function createAppwardenMiddleware(
  configFn: AstroConfigFn,
): AstroMiddlewareFunction {
  return async (context, next) => {
    const { request, locals } = context

    try {
      const runtime = locals.runtime
      if (!runtime) {
        console.error(
          printMessage(
            "Cloudflare runtime not found. Ensure @astrojs/cloudflare adapter is configured.",
          ),
        )
        return next()
      }

      const config = configFn(runtime)

      if (!config.lockPageSlug) {
        return next()
      }

      const isMonitoringRequest =
        request.headers.get("User-Agent") === APPWARDEN_USER_AGENT
      if (isMonitoringRequest) {
        return next()
      }

      const result = await checkLockStatus({
        request,
        appwardenApiToken: config.appwardenApiToken,
        appwardenApiHostname: config.appwardenApiHostname,
        debug: config.debug,
        lockPageSlug: config.lockPageSlug,
        waitUntil: (fn) => runtime.ctx.waitUntil(fn),
      })

      if (result.isLocked) {
        const lockPageSlug = config.lockPageSlug.startsWith("/")
          ? config.lockPageSlug
          : `/${config.lockPageSlug}`
        return context.redirect(lockPageSlug, 302)
      }

      return next()
    } catch (error) {
      console.error(
        printMessage(
          `Error in middleware: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      )
      return next()
    }
  }
}
```

#### 2. New Bundle Entry Point

```typescript
// src/bundles/astro.ts
export {
  createAppwardenMiddleware,
  type AstroAppwardenConfig,
  type AstroCloudflareRuntime,
  type AstroConfigFn,
  type AstroMiddlewareContext,
  type AstroMiddlewareFunction,
} from "../adapters/astro"
```

#### 3. Package.json Export

```json
{
  "exports": {
    "./astro": {
      "types": "./astro.d.ts",
      "default": "./astro.js"
    }
  }
}
```

#### 4. tsup.config.ts Entry

```typescript
entry: {
  index: "src/index.ts",
  vercel: "src/bundles/vercel.ts",
  cloudflare: "src/bundles/cloudflare.ts",
  astro: "src/bundles/astro.ts",  // Add this
},
```

## Key Differences from Current Implementation

| Aspect            | Current Worker Entry Approach         | Proposed `createAppwardenMiddleware`   |
| ----------------- | ------------------------------------- | -------------------------------------- |
| Integration point | Custom `src/worker.ts`                | Native `src/middleware.ts`             |
| Returns           | Wrapped fetch handler                 | Middleware function                    |
| Origin fetching   | Built-in (`useFetchOrigin`)           | Not included (Astro handles routing)   |
| Lock page         | Renders directly via `renderLockPage` | Uses `context.redirect()` to lock page |
| Runs              | Before Astro handler                  | Within Astro's middleware chain        |
| Configuration     | Via wrangler.jsonc `main` field       | Standard Astro middleware file         |

## Implementation Considerations

### 1. Cloudflare Runtime Access

Astro on Cloudflare exposes the runtime context via `context.locals.runtime` when using the `@astrojs/cloudflare` adapter. Users must configure their `astro.config.mjs`:

```javascript
import { defineConfig } from "astro/config"
import cloudflare from "@astrojs/cloudflare"

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true, // Required for locals.runtime access
    },
  }),
})
```

### 2. Edge Cache Access

The current implementation relies on `caches.open("appwarden:lock")` which is available globally in Workers. This works the same way in Astro middleware since it runs in the Cloudflare Workers runtime.

### 3. waitUntil Support

The `ExecutionContext.waitUntil` is available via `context.locals.runtime.ctx.waitUntil`. This allows background tasks (like cache syncing) to continue after the response is sent.

### 4. Lock Page as a Route

The middleware uses `context.redirect()` to redirect to the lock page. This means:

- The lock page must be a valid Astro route (e.g., `src/pages/maintenance.astro`)
- Users need to create the lock page route themselves
- The redirect is a 302 by default (temporary redirect)

### 5. Chaining with Other Middleware

Astro supports chaining middleware via `sequence()`:

```typescript
import { sequence } from "astro:middleware"
import { createAppwardenMiddleware } from "@appwarden/middleware/astro"

const appwarden = createAppwardenMiddleware(/* config */)
const auth = defineMiddleware(/* auth logic */)
const logging = defineMiddleware(/* logging logic */)

// Appwarden runs first, then auth, then logging
export const onRequest = sequence(appwarden, auth, logging)
```

## Alternative: Rewrite Instead of Redirect

Instead of redirecting, we could use Astro's `context.rewrite()`:

```typescript
if (result.isLocked) {
  return context.rewrite(config.lockPageSlug)
}
```

This would:

- Keep the original URL in the browser
- Render the lock page content at the current URL
- Require Astro 4.13.0+ (when `rewrite` was added)

**Recommendation**: Support both via a config option:

```typescript
interface AstroAppwardenConfig {
  lockPageSlug: string
  lockBehavior?: "redirect" | "rewrite" // default: "redirect"
  // ...
}
```

## Open Questions

1. **Should we support both redirect and rewrite?** Some users may want the URL to change, others may want it to stay the same.

2. **How to handle static pages?** Astro middleware runs for all routes including prerendered pages. Should we skip static assets?

3. **Multi-domain support?** The current implementation supports `multidomainConfig`. How should this work with Astro's routing?

4. **Non-Cloudflare deployments?** This adapter assumes Cloudflare. Should we support other Astro adapters (Vercel, Node, etc.)?

5. **TypeScript types?** Should we provide ambient type declarations for `context.locals.runtime`?

## Peer Dependencies

Consider adding `astro` as an optional peer dependency:

```json
{
  "peerDependencies": {
    "next": ">=14",
    "astro": ">=4.0.0"
  },
  "peerDependenciesMeta": {
    "next": { "optional": true },
    "astro": { "optional": true }
  }
}
```

## Timeline Estimate

- **Phase 1**: Create Astro adapter (`src/adapters/astro.ts`) (1-2 days)
- **Phase 2**: Create bundle entry point and update exports (0.5 days)
- **Phase 3**: Add unit tests (1-2 days)
- **Phase 4**: Update documentation (1 day)
- **Phase 5**: Testing and refinement (1-2 days)

**Total**: ~5-8 days

## Documentation Updates

After implementation, update:

1. **New guide**: Create `websites/appwarden-io/content/docs/300-guides/211-astro-native-middleware.mdx` for the native middleware approach
2. **Existing guide**: Update `210-astro-cloudflare.mdx` to reference the native approach as the recommended method
3. **Package README**: Add Astro to supported frameworks list
4. **API reference**: Document the `createAppwardenMiddleware` function and types

## References

- [Astro Middleware Documentation](https://docs.astro.build/en/guides/middleware/)
- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Astro defineMiddleware API](https://docs.astro.build/en/reference/modules/astro-middleware/)
- [React Router Middleware Adapter](./react-router-middleware-adapter.md) (similar pattern)

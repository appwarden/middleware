# Cloudflare Framework Adapters: Post-Origin Middleware Report

## Overview

This document summarizes the Cloudflare framework adapters present in the Appwarden middleware stack and whether each underlying framework supports **post-origin** middleware (middleware that can observe and/or modify the `Response` after the origin route/handler has run). It also sketches how Appwarden’s `useContentSecurityPolicy` (CSP) middleware can be wired into each framework that supports response-phase behavior.

Adapters discovered in `src/adapters/index.ts`:

- `react-router-cloudflare` → React Router on Cloudflare
- `astro-cloudflare` → Astro on Cloudflare
- `tanstack-start-cloudflare` → TanStack Start on Cloudflare
- `nextjs-cloudflare` → Next.js on Cloudflare

---

## Framework capabilities summary

| Adapter file                   | Framework            | Post-origin middleware?  | Notes                                                                                                                                  |
| ------------------------------ | -------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `astro-cloudflare.ts`          | Astro (Cloudflare)   | **Yes**                  | `onRequest` middleware can `await next()` and then inspect/modify the `Response`, including HTML.                                      |
| `tanstack-start-cloudflare.ts` | TanStack Start (CF)  | **Yes**                  | Middleware runs around server functions/requests; can `await next()` and adjust response headers/body.                                 |
| `react-router-cloudflare.ts`   | React Router (CF)    | **Yes**                  | Server middleware (`unstable_middleware`) uses `let response = await next()` and can mutate the `Response`.                            |
| `nextjs-cloudflare.ts`         | Next.js (Cloudflare) | **No (framework-level)** | Next.js middleware runs before origin and never sees the final `Response`; CSP is configured via static headers or per-route handlers. |

---

## Astro on Cloudflare (`astro-cloudflare.ts`)

**Finding:** Astro middleware supports post-origin behavior.

Astro’s `onRequest` API allows:

- `const response = await next()` to let the page/endpoint render.
- Reading/modifying the returned `Response` (for example, `await response.text()` and then `new Response(...)`).

This maps cleanly to Appwarden’s “run after origin” CSP behavior.

### Sketch: Wiring Appwarden CSP for Astro

Conceptual wiring (shape only, not exact API):

```ts
// src/middleware.ts
import { createAstroAppwardenMiddleware } from "@appwarden/middleware/adapters"
import { createAppwardenOnCloudflareRunner } from "@appwarden/middleware/cloudflare"
import { useContentSecurityPolicy } from "@appwarden/middleware"

const appwardenAstro = createAstroAppwardenMiddleware({
  runner: createAppwardenOnCloudflareRunner({
    middlewares: [useContentSecurityPolicy()],
  }),
})

export const onRequest = appwardenAstro(async (context, next) => {
  const response = await next()
  return response
})
```

Key idea: the Astro adapter wraps an `onRequest` handler that delegates to the Cloudflare runner. The runner calls the origin handler, applies `useContentSecurityPolicy` to the resulting `Response`, and returns the CSP-aware `Response` to Astro.

---

## TanStack Start on Cloudflare (`tanstack-start-cloudflare.ts`)

**Finding:** TanStack Start middleware supports pre- and post-origin behavior.

TanStack Start’s middleware (via `createMiddleware`) supports:

- Running client/server hooks.
- On the server, `const result = await next()` and then mutating headers or other response data.

This is a natural fit for Appwarden’s CSP middleware.

### Sketch: Wiring Appwarden CSP for TanStack Start

Conceptual wiring in `start.ts` or equivalent:

```ts
// start.ts
import { startInstance } from "@tanstack/react-start"
import { createTanStackStartAppwardenMiddleware } from "@appwarden/middleware/adapters"
import { createAppwardenOnCloudflareRunner } from "@appwarden/middleware/cloudflare"
import { useContentSecurityPolicy } from "@appwarden/middleware"

const appwardenStartMiddleware = createTanStackStartAppwardenMiddleware({
  runner: createAppwardenOnCloudflareRunner({
    middlewares: [useContentSecurityPolicy()],
  }),
})

export const start = startInstance(() => ({
  requestMiddleware: [appwardenStartMiddleware],
}))
```

Inside `createTanStackStartAppwardenMiddleware`, the implementation can call `const response = await next();`, pass that `Response` into the Cloudflare runner (which applies `useContentSecurityPolicy`), and return the CSP-updated `Response` back into the TanStack Start pipeline.

---

## React Router on Cloudflare (`react-router-cloudflare.ts`)

**Finding:** React Router server middleware supports post-origin behavior via `unstable_middleware`.

In React Router 7+, server runtimes can define middleware that:

- Has a signature roughly `({ request, next }) => Promise<Response>`.
- Uses `let response = await next();` to let loaders/actions/routes run.
- Mutates and returns `response` (for example, to add security headers).

This allows Appwarden to run CSP logic after the route handler.

### Sketch: Wiring Appwarden CSP for React Router

Conceptual wiring in `react-router.config.ts` (server runtime):

```ts
// react-router.config.ts
import type { Config } from "@react-router/dev"
import { createReactRouterAppwardenMiddleware } from "@appwarden/middleware/adapters"
import { createAppwardenOnCloudflareRunner } from "@appwarden/middleware/cloudflare"
import { useContentSecurityPolicy } from "@appwarden/middleware"

const appwardenReactRouterMiddleware = createReactRouterAppwardenMiddleware({
  runner: createAppwardenOnCloudflareRunner({
    middlewares: [useContentSecurityPolicy()],
  }),
})

export default {
  future: { unstable_middleware: true },
  unstable_middleware: [appwardenReactRouterMiddleware],
} satisfies Config
```

Internally, the React Router adapter can accept `{ request, next }`, call `const response = await next();`, run the Cloudflare runner with `useContentSecurityPolicy` against that `Response`, and return the CSP-enhanced `Response`.

---

## Next.js on Cloudflare (`nextjs-cloudflare.ts`)

**Finding:** Next.js middleware is request-only and does not support true post-origin response-phase middleware.

- Next.js `middleware.ts` runs before the route handler and never sees the final `Response`.
- CSP and security headers are configured via `next.config.js` `headers()` or per-route handlers.

As a result, Appwarden cannot currently implement _framework-level_ post-origin CSP middleware inside Next.js itself. A possible strategy is to run Appwarden’s universal Cloudflare middleware **in front of** the Next.js app (as a Worker that proxies to Next), and apply `useContentSecurityPolicy` on the proxied `Response` there, but that is outside the scope of the Next.js adapter proper.

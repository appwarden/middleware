# Refactoring Plan: Internal CSP Middleware with Framework-Aware Execution

## Overview

The goal is to move `useContentSecurityPolicy` from being a user-composed middleware in the `middleware.before` array to an internal, first-class configuration option. The CSP middleware should automatically run:

- **After origin** for frameworks that support post-origin middleware (Astro, TanStack Start, React Router)
- **Before origin** for frameworks that don't (Next.js)

## Key Changes Required

### 1. Schema Updates

**Files to modify:**

- `src/schemas/use-appwarden.ts` - Add `contentSecurityPolicy` field to base schema
- `src/schemas/cloudflare.ts` - Update `CloudflareConfigType` to include CSP config
- `src/schemas/astro-cloudflare.ts` - Add CSP config to Astro schema
- `src/schemas/tanstack-start-cloudflare.ts` - Add CSP config to TanStack Start schema
- `src/schemas/react-router-cloudflare.ts` - Add CSP config to React Router schema
- `src/schemas/nextjs-cloudflare.ts` - Add CSP config to Next.js schema

**Changes:**

```typescript
// Add to UseAppwardenInputSchema
export const UseAppwardenInputSchema = z.object({
  debug: BooleanSchema.default(false),
  lockPageSlug: z.string().optional(),
  multidomainConfig: AppwardenMultidomainConfigSchema.optional(),
  appwardenApiToken: AppwardenApiTokenSchema,
  appwardenApiHostname: z.string().optional(),
  // NEW: CSP configuration
  contentSecurityPolicy: UseCSPInputSchema.optional(),
})
```

### 2. Cloudflare Runner Updates (`src/runners/appwarden-on-cloudflare.ts`)

**Current behavior:**

- Pipeline: `[...middleware.before, useAppwarden, useFetchOrigin]`
- CSP runs before origin if in `middleware.before`

**New behavior:**

- If `contentSecurityPolicy` is defined, automatically inject CSP middleware **after** `useFetchOrigin`
- Remove `middleware.before` support entirely
- Pipeline: `[useAppwarden, useFetchOrigin, ...cspMiddleware]`

**Implementation:**

```typescript
const pipeline = [useAppwarden(validatedInput), useFetchOrigin()]

// Add CSP middleware after origin if configured
if (validatedInput.contentSecurityPolicy) {
  pipeline.push(useContentSecurityPolicy(validatedInput.contentSecurityPolicy))
}

await usePipeline(...pipeline).execute(context)
```

### 3. Framework Adapter Updates

#### Astro Adapter (`src/adapters/astro-cloudflare.ts`)

**Current:** Only handles lock page logic  
**New:** Add CSP support that runs after `next()`

```typescript
export function createAppwardenMiddleware(
  configFn: AstroConfigFn,
): MiddlewareHandler {
  return async (context, next) => {
    // ... existing lock page logic (runs before origin) ...

    // Call next to render the route
    const response = await next()

    // Apply CSP if configured (runs after origin)
    if (config.contentSecurityPolicy) {
      // Create a mini context for CSP middleware
      const cspContext = {
        request: context.request,
        response,
        hostname: new URL(context.request.url).hostname,
        // ... other context fields
      }

      await useContentSecurityPolicy(config.contentSecurityPolicy)(
        cspContext,
        async () => {}, // no-op next
      )

      return cspContext.response
    }

    return response
  }
}
```

#### TanStack Start Adapter (`src/adapters/tanstack-start-cloudflare.ts`)

Similar pattern - apply CSP after `await next()`

```typescript
// After lock page check
const result = await next()

// Apply CSP if configured
if (config.contentSecurityPolicy) {
  const cspContext = {
    request,
    response: result as Response,
    hostname: new URL(request.url).hostname,
  }

  await useContentSecurityPolicy(config.contentSecurityPolicy)(
    cspContext,
    async () => {},
  )

  return cspContext.response
}

return result
```

#### React Router Adapter (`src/adapters/react-router-cloudflare.ts`)

Similar pattern - apply CSP after `await next()`

```typescript
// After lock page check
const result = await next()

// Apply CSP if configured
if (config.contentSecurityPolicy) {
  const cspContext = {
    request,
    response: result as Response,
    hostname: new URL(request.url).hostname,
  }

  await useContentSecurityPolicy(config.contentSecurityPolicy)(
    cspContext,
    async () => {},
  )

  return cspContext.response
}

return result
```

#### Next.js Adapter (`src/adapters/nextjs-cloudflare.ts`)

**Challenge:** Next.js middleware runs before origin and can't see final Response  
**Solution:** Apply CSP headers to the `NextResponse` before origin (limited - headers only, no HTML rewriting)

```typescript
// In Next.js adapter, before calling next()
if (
  config.contentSecurityPolicy &&
  config.contentSecurityPolicy.mode !== "disabled"
) {
  const cspNonce = crypto.randomUUID()
  const [headerName, headerValue] = makeCSPHeader(
    cspNonce,
    config.contentSecurityPolicy.directives,
    config.contentSecurityPolicy.mode,
  )

  const response = NextResponse.next()
  response.headers.set(headerName, headerValue)
  return response
}
```

**Note:** Next.js won't support HTML rewriting (nonce injection) at framework level - document this limitation.

### 4. Type Updates

Update all config types to include optional `contentSecurityPolicy`:

```typescript
export interface AstroAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
  contentSecurityPolicy?: UseCSPInput // NEW
}

export interface TanStackStartAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
  contentSecurityPolicy?: UseCSPInput // NEW
}

export interface ReactRouterAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
  contentSecurityPolicy?: UseCSPInput // NEW
}

export interface NextJsCloudflareAppwardenConfig {
  lockPageSlug: string
  appwardenApiToken: string
  appwardenApiHostname?: string
  debug?: boolean
  contentSecurityPolicy?: UseCSPInput // NEW
}
```

### 5. Documentation Updates

**Files to update:**

- `README.md` - Update examples to use new API
- `hello.md` - Update sketches to reflect actual implementation
- All adapter JSDoc comments

**Before (Cloudflare runner - REMOVED):**

```typescript
// withAppwarden no longer exists - use createAppwardenMiddleware from adapters
withAppwarden((context) => ({
  debug: context.env.DEBUG,
  lockPageSlug: context.env.LOCK_PAGE_SLUG,
  appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
  middleware: {
    before: [
      useContentSecurityPolicy({
        mode: context.env.CSP_MODE,
        directives: context.env.CSP_DIRECTIVES,
      }),
    ],
  },
}))
```

**After (Cloudflare runner):**

```typescript
// Use the universal Cloudflare runner directly
export default {
  fetch: createAppwardenOnCloudflareRunner((context) => ({
    debug: context.env.DEBUG,
    lockPageSlug: context.env.LOCK_PAGE_SLUG,
    appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
    contentSecurityPolicy: {
      mode: context.env.CSP_MODE,
      directives: context.env.CSP_DIRECTIVES,
    },
  })),
}
```

**Framework adapter example (Astro):**

```typescript
// src/middleware.ts
import { createAstroAppwardenMiddleware } from "@appwarden/middleware/adapters"

export const onRequest = createAstroAppwardenMiddleware(({ env }) => ({
  lockPageSlug: env.LOCK_PAGE_SLUG,
  appwardenApiToken: env.APPWARDEN_API_TOKEN,
  contentSecurityPolicy: {
    mode: env.CSP_MODE,
    directives: env.CSP_DIRECTIVES,
  },
}))
```

### 6. Test Updates

**Files to update:**

- `src/runners/appwarden-on-cloudflare.test.ts` - Test CSP injection after origin
- `src/adapters/astro-cloudflare.test.ts` - Test CSP in Astro adapter
- `src/adapters/tanstack-start-cloudflare.test.ts` - Test CSP in TanStack adapter
- `src/adapters/react-router-cloudflare.test.ts` - Test CSP in React Router adapter
- `src/adapters/nextjs-cloudflare.test.ts` - Test CSP headers in Next.js adapter
- `src/test/cloudflare-app.ts` - Update test app to use new API

## Implementation Order

1. **Schema updates** - Add `contentSecurityPolicy` field to all schemas
2. **Cloudflare runner** - Remove `middleware.before`, implement post-origin CSP injection
3. **Astro adapter** - Implement post-origin CSP
4. **TanStack Start adapter** - Implement post-origin CSP
5. **React Router adapter** - Implement post-origin CSP
6. **Next.js adapter** - Implement pre-origin CSP headers (limited)
7. **Test updates** - Update all tests to use new API
8. **Documentation** - Update README and examples
9. **Remove `withAppwarden`** - Delete the deprecated export

## Breaking Changes

This is a **breaking change** that requires a major version bump:

1. **Removed:** `middleware.before` configuration option
2. **Removed:** `withAppwarden` export (use `createAppwardenOnCloudflareRunner` directly)
3. **Changed:** CSP is now configured via `contentSecurityPolicy` field instead of composing `useContentSecurityPolicy` manually
4. **Changed:** `useContentSecurityPolicy` is no longer exported for manual composition (internal use only)

## Migration Guide

### Cloudflare Universal Runner

**Before:**

```typescript
import { withAppwarden, useContentSecurityPolicy } from "@appwarden/middleware/cloudflare"

export default {
  fetch: withAppwarden((context) => ({
    lockPageSlug: context.env.LOCK_PAGE_SLUG,
    appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
    middleware: {
      before: [useContentSecurityPolicy({ mode: "enforced", directives: {...} })],
    },
  })),
}
```

**After:**

```typescript
import { createAppwardenOnCloudflareRunner } from "@appwarden/middleware/cloudflare"

export default {
  fetch: createAppwardenOnCloudflareRunner((context) => ({
    lockPageSlug: context.env.LOCK_PAGE_SLUG,
    appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
    contentSecurityPolicy: { mode: "enforced", directives: {...} },
  })),
}
```

### Framework Adapters

**Before:**

```typescript
import { createAstroAppwardenMiddleware } from "@appwarden/middleware/adapters"
import { useContentSecurityPolicy } from "@appwarden/middleware"

// CSP had to be added separately - not supported
```

**After:**

```typescript
import { createAstroAppwardenMiddleware } from "@appwarden/middleware/adapters"

export const onRequest = createAstroAppwardenMiddleware(({ env }) => ({
  lockPageSlug: env.LOCK_PAGE_SLUG,
  appwardenApiToken: env.APPWARDEN_API_TOKEN,
  contentSecurityPolicy: { mode: "enforced", directives: {...} },
}))
```

## Benefits

1. **Simpler API** - Users don't need to import and compose `useContentSecurityPolicy`
2. **Framework-aware** - CSP automatically runs at the right time for each framework
3. **Type safety** - CSP config is validated as part of main config
4. **Consistency** - All security features (lock page, CSP) configured in one place
5. **Better DX** - Less boilerplate, clearer intent
6. **Post-origin by default** - CSP runs after origin for frameworks that support it, enabling HTML rewriting and nonce injection

## Framework Capabilities Summary

| Framework            | Post-origin CSP? | HTML Rewriting? | Notes                        |
| -------------------- | ---------------- | --------------- | ---------------------------- |
| Astro (Cloudflare)   | ✅ Yes           | ✅ Yes          | Uses `await next()` pattern  |
| TanStack Start (CF)  | ✅ Yes           | ✅ Yes          | Uses `await next()` pattern  |
| React Router (CF)    | ✅ Yes           | ✅ Yes          | Uses `await next()` pattern  |
| Next.js (Cloudflare) | ❌ No            | ❌ No           | Headers only, no HTML access |
| Cloudflare Universal | ✅ Yes           | ✅ Yes          | Full control over pipeline   |

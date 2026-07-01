---
name: vercel-edge
description: >
  Integrate @appwarden/middleware with Vercel Edge Middleware. Choose and configure Upstash KV or Vercel Edge Config as the cache provider, set the matcher and runtime, and use headers-only CSP. Load this skill when a user is deploying on Vercel.
metadata:
  type: framework
  library: "@appwarden/middleware"
  library_version: "3.16.3"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/guides/vercel-middleware-integration.mdx"
  - "https://vercel.com/docs/edge-config/using-edge-config"
  - "https://upstash.com/docs/workflow/troubleshooting/vercel"
  - "appwarden/middleware:src/runners/appwarden-on-vercel.ts"
  - "appwarden/middleware:src/schemas/vercel.ts"
---

# Appwarden Middleware — Wire into Vercel Edge Middleware

Vercel Edge Middleware runs at the edge and can redirect HTML traffic to a lock page. On Vercel, Appwarden does not support nonce-based CSP because HTML rewriting is not available. Use a headers-only CSP if you need CSP at all.

## Setup

1. Install the package:

```bash
npm install @appwarden/middleware
```

2. Create or update `middleware.ts` in the project root or `src/` (if using a `src/` layout).
3. Choose a cache provider: Upstash KV or Vercel Edge Config.
4. Set the environment variables and deploy.
5. Add a build hook such as `"prebuild": "appwarden-link --fqdn=your.app"`

## Core Patterns

### Minimal middleware.ts

```typescript
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/vercel"

export default createAppwardenMiddleware(
  getAppwardenConfiguration(
    {},
    {
      appwardenApiToken: process.env.APPWARDEN_API_TOKEN,
      lockPageSlug: "/maintenance",
      cacheUrl: process.env.KV_URL,
      debug: true,
    },
  ),
)

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### Matcher configuration

Exclude static assets, API routes, and image optimization from the middleware to avoid unnecessary edge usage:

```typescript
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### Upstash KV cache provider

Add the Upstash KV integration from the Vercel Marketplace. It populates the `KV_URL` environment variable:

```text
KV_URL=rediss://:password@hostname.upstash.io:6379
```

If `KV_URL` is already set in the project, the integration may populate `UPSTASH_KV_URL` instead. Pass whichever variable is populated to `cacheUrl`.

### Vercel Edge Config cache provider

Create an Edge Config in the Vercel dashboard and connect it to the project. Vercel populates `EDGE_CONFIG` automatically. You also need a Vercel API token with Edge Config management permissions:

```typescript
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/vercel"

export default createAppwardenMiddleware(
  getAppwardenConfiguration(
    {},
    {
      appwardenApiToken: process.env.APPWARDEN_API_TOKEN,
      lockPageSlug: "/maintenance",
      cacheUrl: process.env.EDGE_CONFIG,
      vercelApiToken: process.env.VERCEL_API_TOKEN,
      debug: true,
    },
  ),
)
```

### Headers-only CSP on Vercel

```typescript
contentSecurityPolicy: {
  mode: 'enforced',
  directives: {
    'default-src': ["'self'"],
  },
}
```

Do not use `{{nonce}}` on Vercel. The Edge Middleware cannot rewrite HTML to inject nonces.

## Common Mistakes

### CRITICAL Using Edge Config without providing vercelApiToken

Wrong:

```typescript
createAppwardenMiddleware({
  cacheUrl: process.env.EDGE_CONFIG,
  appwardenApiToken: process.env.APPWARDEN_API_TOKEN,
})
```

Correct:

```typescript
createAppwardenMiddleware({
  cacheUrl: process.env.APPWARDEN_CACHE_URL,
  vercelApiToken: process.env.VERCEL_API_TOKEN,
  appwardenApiToken: process.env.APPWARDEN_API_TOKEN,
})
```

Edge Config requires a Vercel API token to manage the quarantine status. Without it, the schema rejects the configuration.

### HIGH Using an unrecognized cacheUrl format or wrong env var name

Wrong:

```typescript
cacheUrl: process.env.REDIS_URL
```

Correct:

```typescript
cacheUrl: process.env.KV_URL // Upstash KV
// or cacheUrl: process.env.EDGE_CONFIG // Vercel Edge Config
```

The schema only recognizes Upstash KV or Vercel Edge Config URLs. Upstash integration sets `KV_URL` (or `UPSTASH_KV_URL` if `KV_URL` is already taken), and Edge Config sets `EDGE_CONFIG`.

### MEDIUM Using Upstash KV but not assigning KV_URL correctly

Wrong:

```typescript
cacheUrl: process.env.KV_URL
// but UPSTASH_KV_URL is the actual populated variable
```

Correct:

```typescript
// Verify which env var the Upstash integration populated and pass that to cacheUrl
cacheUrl: process.env.KV_URL ?? process.env.UPSTASH_KV_URL
```

### HIGH Using Edge Config without a Vercel API token that can manage Edge Config

Wrong:

```typescript
cacheUrl: process.env.EDGE_CONFIG,
vercelApiToken: process.env.VERCEL_API_TOKEN, // token lacks Edge Config scope
```

Correct:

```typescript
// Create a Vercel API token with the Edge Config scope
cacheUrl: process.env.EDGE_CONFIG,
vercelApiToken: process.env.VERCEL_API_TOKEN,
```

The token must have permission to read and write Edge Config items for the project.

### HIGH Configuring Appwarden to read quarantine status through api.vercel.com

Wrong:

```typescript
cacheUrl: "https://api.vercel.com/v1/edge-config/ecfg_..."
```

Correct:

```typescript
cacheUrl: process.env.EDGE_CONFIG // https://edge-config.vercel.com/ecfg_...
```

`api.vercel.com` is for managing Edge Configs and is rate-limited to 20 reads per minute. Runtime reads must go through the Edge Config endpoint.

### MEDIUM Losing the Edge Config read access token and not creating a new one

Vercel shows the full Edge Config read token only once after creation. If it is lost, delete and recreate the token, then update `EDGE_CONFIG` in the project.

### HIGH Including {{nonce}} in CSP directives for Vercel

Wrong:

```typescript
contentSecurityPolicy: {
  mode: 'enforced',
  directives: { 'script-src': ["'self'", '{{nonce}}"] },
}
```

Correct:

```typescript
contentSecurityPolicy: {
  mode: 'enforced',
  directives: { 'default-src': ["'self'"] },
}
```

Vercel Edge Middleware cannot rewrite HTML to inject nonces.

### MEDIUM Matching static assets and API routes in the middleware matcher

Wrong:

```typescript
export const config = { matcher: ["/(.*)"] }
```

Correct:

```typescript
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

Matching static assets and API routes increases edge usage and can cause unnecessary overhead.

### MEDIUM Relying on the module-level memory cache for multi-tenant Vercel deployments

The Vercel runner uses a single module-level `MemoryCache` with a fixed key. If multiple logical hosts share the same runtime process, lock state can bleed across hosts. Keep `cacheUrl` and `appwardenApiToken` scoped per project.

### MEDIUM Enabling Vercel Deployment Protection without a bypass secret for automated verification

When Deployment Protection is enabled, automated requests to preview deployments can be blocked. Add a Protection Bypass for Automation secret in Vercel project settings and pass it as `x-vercel-protection-bypass` where required.

## Next Steps

- For headers-only CSP patterns, see `appwarden-middleware-csp`.
- For Cloudflare instead of Vercel, see `appwarden-middleware-cloudflare-adapters`.
- To verify the setup, see `appwarden-middleware-verify-setup`.

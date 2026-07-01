# Vercel Edge Config Cache Provider for Appwarden

Use this reference when configuring Appwarden on Vercel Edge Middleware with Vercel Edge Config as the cache provider.

## Setup

1. Create an Edge Config in the Vercel dashboard.
2. Connect it to the project. Vercel automatically populates the `EDGE_CONFIG` environment variable with the read URL.
3. Create a Vercel API token with Edge Config read/write permissions.
4. Add the API token to the project as `VERCEL_API_TOKEN`.

## Middleware code

```typescript
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/vercel"
import appwardenConfig from "./.appwarden/linked/middleware.json"

export default createAppwardenMiddleware(() =>
  getAppwardenConfiguration(appwardenConfig, {
    appwardenApiToken: process.env.APPWARDEN_API_TOKEN,
    lockPageSlug: "/maintenance",
    cacheUrl: process.env.EDGE_CONFIG,
    vercelApiToken: process.env.VERCEL_API_TOKEN,
    debug: true,
  }),
)
```

## Read vs management endpoints

- **Runtime reads:** `https://edge-config.vercel.com/ecfg_...` (provided by `EDGE_CONFIG`). This is the CDN-optimized, high-volume endpoint.
- **Management:** `https://api.vercel.com/...` (used by the middleware with `VERCEL_API_TOKEN` for writes). This is rate-limited to 20 Edge Config item reads per minute and is not suitable for runtime reads.

## Read access token

When creating a read access token, Vercel shows the full token only once. Store it immediately. If lost, delete and recreate the token, then update `EDGE_CONFIG` in the project.

## Common gotchas

- Missing `vercelApiToken` causes the Appwarden schema to reject the configuration.
- The Vercel API token must have the Edge Config scope, not just project read scope.
- Do not use `api.vercel.com` as the `cacheUrl`.

# Upstash KV Cache Provider for Appwarden on Vercel

Use this reference when configuring Appwarden on Vercel Edge Middleware with Upstash KV as the cache provider.

## Setup

1. Add the Upstash KV integration from the Vercel Marketplace to your project.
2. The integration populates the `KV_URL` environment variable.
3. No Vercel API token is needed for this provider.

## Middleware code

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
```

## Environment variable name

By default, the Vercel Upstash KV integration uses `KV_URL`. If `KV_URL` is already set in the project, the integration may populate `UPSTASH_KV_URL` instead. Verify which variable is populated and pass the correct one to `cacheUrl`:

```typescript
cacheUrl: process.env.KV_URL ?? process.env.UPSTASH_KV_URL
```

## Pricing note

Upstash KV is a managed Redis service. Usage-based charges may apply. Review the Upstash pricing before production use.

## Common gotchas

- Passing `process.env.REDIS_URL` or another non-Upstash URL causes the Appwarden schema to reject the configuration.
- Do not set `vercelApiToken` for Upstash KV. It is only needed for Edge Config.
- If lifecycle scripts are disabled, the Vercel Marketplace integration still populates the env var at deploy time, but verify the variable is present in the deployed environment.

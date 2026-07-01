# Appwarden on React Router Cloudflare Adapter

Use this reference when wiring Appwarden into a React Router app deployed with the Cloudflare adapter.

## Prerequisites

- React Router project with `@react-router/cloudflare` installed.
- `appwarden-link --fqdn=your.app` configured as a prebuild script.
- `.appwarden/linked/` added to `.gitignore`.

## Enable middleware

Set `future.v8_middleware: true` in `react-router.config.ts`:

```typescript
export default {
  ssr: true,
  future: {
    v8_middleware: true,
  },
}
```

## Middleware file

Export the middleware array from `app/root.tsx`:

```typescript
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/cloudflare/react-router"
import appwardenConfig from "../.appwarden/linked/middleware.json"

export const middleware = [
  createAppwardenMiddleware((context) =>
    getAppwardenConfiguration(appwardenConfig, {
      appwardenApiToken: context.cloudflare.env.APPWARDEN_API_TOKEN,
      debug: true,
    }),
  ),
]
```

## Environment access

React Router Cloudflare exposes the Worker environment on `context.cloudflare.env`. Access `APPWARDEN_API_TOKEN` there.

## CSP notes

React Router Cloudflare supports HTML rewriting, so `{{nonce}}` CSP directives work. Add `nonce` attributes to inline scripts and styles.

## Common gotchas

- Without `future.v8_middleware: true`, the exported `middleware` array is ignored and Appwarden never runs.
- The `appwarden-link` prebuild step is required to generate the linked config.

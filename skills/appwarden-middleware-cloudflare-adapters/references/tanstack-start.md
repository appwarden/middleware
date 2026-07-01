# Appwarden on TanStack Start Cloudflare Adapter

Use this reference when wiring Appwarden into a TanStack Start app deployed with the Cloudflare adapter.

## Prerequisites

- TanStack Start project with `@tanstack/react-start` installed.
- `appwarden-link --fqdn=your.app` configured as a prebuild script.
- `.appwarden/linked/` added to `.gitignore`.

## Middleware file

Create `app.config.ts` or `app/ssr.tsx` with `createMiddleware`:

```typescript
import { createMiddleware } from "@tanstack/react-start"
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/cloudflare/tanstack-start"
import appwardenConfig from "../.appwarden/linked/middleware.json"

const appwarden = createAppwardenMiddleware((context) =>
  getAppwardenConfiguration(appwardenConfig, {
    appwardenApiToken: context.cloudflare.env.APPWARDEN_API_TOKEN,
    debug: true,
  }),
)

export default createMiddleware().server(appwarden)
```

## Environment access

TanStack Start Cloudflare exposes the Worker environment on `context.cloudflare.env`. Access `APPWARDEN_API_TOKEN` there.

## CSP notes

TanStack Start Cloudflare supports HTML rewriting, so `{{nonce}}` CSP directives work. Add `nonce` attributes to inline scripts and styles.

## Common gotchas

- Make sure `appwarden-link` runs before the build. The linked config is read at runtime from the bundled output.
- Keep `debug: true` during first setup until the heartbeat is clean.

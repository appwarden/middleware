# Appwarden on Astro Cloudflare Adapter

Use this reference when wiring Appwarden into an Astro site deployed with the `@astrojs/cloudflare` adapter.

## Prerequisites

- Astro project with `@astrojs/cloudflare` adapter installed.
- `appwarden-link --fqdn=your.app` configured as a prebuild script.
- `.appwarden/linked/` added to `.gitignore`.

## Middleware file

Create `src/middleware.ts`:

```typescript
import { defineMiddleware } from "astro:middleware"
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/cloudflare/astro"
import appwardenConfig from "../.appwarden/linked/middleware.json"

const appwarden = createAppwardenMiddleware((context) =>
  getAppwardenConfiguration(appwardenConfig, {
    appwardenApiToken: context.locals.runtime.env.APPWARDEN_API_TOKEN,
    debug: true,
  }),
)

export const onRequest = defineMiddleware((context, next) => {
  return appwarden(context, next)
})
```

## Environment access

Astro Cloudflare exposes the Worker environment on `context.locals.runtime.env`. Access `APPWARDEN_API_TOKEN` there, not on `process.env`.

## CSP notes

The Astro Cloudflare adapter supports HTML rewriting, so `{{nonce}}` CSP directives work. Add `nonce` attributes to `<script>` and `<style>` tags.

## Common gotchas

- Make sure the `prebuild` script runs before `astro build`. If lifecycle scripts are disabled (`ignore-scripts=true`), invoke `appwarden-link` explicitly.
- The middleware file must be named `src/middleware.ts` (or `middleware.ts` if no `src/` layout).

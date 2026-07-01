# Appwarden on Next.js Cloudflare (OpenNext) Adapter

Use this reference when wiring Appwarden into a Next.js app deployed with the Cloudflare (OpenNext) adapter.

## Prerequisites

- Next.js project with `@opennextjs/cloudflare` installed.
- `appwarden-link --fqdn=your.app` configured as a prebuild script.
- `.appwarden/linked/` added to `.gitignore`.

## Middleware file location

- Next.js 15 and earlier: `middleware.ts` (project root or `src/`).
- Next.js 16+: `proxy.ts` (project root or `src/`). `middleware.ts` is silently ignored in Next.js 16+.

## Next.js 15 and earlier example

```typescript
// middleware.ts
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/cloudflare/nextjs"
import appwardenConfig from "./.appwarden/linked/middleware.json"

export default createAppwardenMiddleware((request) =>
  getAppwardenConfiguration(appwardenConfig, {
    appwardenApiToken: request.cloudflare.env.APPWARDEN_API_TOKEN,
    debug: true,
  }),
)

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

## Next.js 16+ example

Same code, but in `proxy.ts` instead of `middleware.ts`.

## Environment access

Next.js Cloudflare exposes the Worker environment on `request.cloudflare.env`. Access `APPWARDEN_API_TOKEN` there.

## CSP notes

**Important:** The OpenNext adapter applies CSP headers only before the origin. It does **not** rewrite HTML to inject nonces. Use headers-only CSP directives for this adapter. Do not use `{{nonce}}`.

## Common gotchas

- Make sure `appwarden-link` runs before the build. The linked config is read at runtime from the bundled output.
- A `middleware.ts` placed at the project root is ignored when the app uses a `src/` layout. Use `src/middleware.ts` in that case.
- The lock page may not receive CSP headers injected by the middleware because the adapter short-circuits when the request is already on the lock page. Apply CSP at the page level if needed.

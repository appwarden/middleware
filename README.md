# @appwarden/middleware

[![Docs](https://img.shields.io/badge/Documentation-blue)](https://appwarden.io/docs/reference/appwarden-middleware)
[![GitHub](https://img.shields.io/badge/GitHub-appwarden%2Fmiddleware-181717?logo=github&logoColor=white)](https://github.com/appwarden/middleware)
[![npm version](https://img.shields.io/npm/v/@appwarden/middleware.svg)](https://www.npmjs.com/package/@appwarden/middleware)
[![npm provenance](https://img.shields.io/badge/npm-provenance-green)](https://docs.npmjs.com/generating-provenance-statements)
![Test Coverage](https://img.shields.io/badge/coverage-91.5%25-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Core Features

- **Discord Integration**: Quarantine your website via Discord commands (`/quarantine [un]lock`)
- **Instant Quarantine**: Immediately redirects all visitors to a lock page when activated to stop in progress attacks.
- **Nonce-based Content Security Policy (See [Feature Compatibility](#feature-compatibility))**: Deploy a nonce-based Content Security Policy (CSP) using HTML rewriting on Cloudflare where supported.
- **Minimal Runtime Overhead**: Negligible performance impact by using `event.waitUntil` for status checks

### Feature Compatibility

The table below summarizes which Appwarden features are available on each platform, including quarantine enforcement and Content Security Policy (CSP) support (with or without nonces).

| Platform / Adapter                      | Package / entrypoint                              | Quarantine | CSP | CSP Nonce |
| --------------------------------------- | ------------------------------------------------- | ---------- | --- | --------- |
| Cloudflare – Universal middleware       | `@appwarden/middleware/cloudflare`                | ✅         | ✅  | ✅        |
| Cloudflare – Astro                      | `@appwarden/middleware/cloudflare/astro`          | ✅         | ✅  | ✅        |
| Cloudflare – React Router               | `@appwarden/middleware/cloudflare/react-router`   | ✅         | ✅  | ✅        |
| Cloudflare – TanStack Start             | `@appwarden/middleware/cloudflare/tanstack-start` | ✅         | ✅  | ✅        |
| Cloudflare – Next.js (OpenNext adapter) | `@appwarden/middleware/cloudflare/nextjs`         | ✅         | ✅  | ❌        |
| Vercel - Universal middleware           | `@appwarden/middleware/vercel`                    | ✅         | ✅  | ❌        |

Nonce-based CSP requires HTML rewriting and is only available on Cloudflare. Next.js on Cloudflare (OpenNext) and Vercel Edge Middleware apply CSP headers only and do **not** support nonces. If you are using Next.js on Cloudflare, please use the Cloudflare Universal middleware for CSP nonce support.

## Configuration

The following options are shared across the Cloudflare and Vercel middleware bundles.

### `lockPageSlug`

The path or route (for example, `/maintenance`) to redirect users to when the domain is quarantined.
This should be a working page on your site, such as a maintenance or status page, that
explains why the website is temporarily unavailable.

### `contentSecurityPolicy`

Controls the [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) headers that Appwarden adds.

- `mode` (optional) controls how the CSP is applied:
  - `"disabled"` – no CSP header is sent.
  - `"report-only"` – sends the `Content-Security-Policy-Report-Only` header so violations are
    reported (for example in the browser console) but not blocked.
  - `"enforced"` – sends the `Content-Security-Policy` header so violations are actively blocked.

  When developing or iterating on your CSP, we recommend starting with `"report-only"` so you can
  identify and fix violations before switching to `"enforced"`.

- `directives` (optional) is an object whose keys are CSP directive names and whose values are
  arrays of allowed sources. For example:

  ```ts
  contentSecurityPolicy: {
    mode: "enforced",
    directives: {
      "script-src": ["'self'", "{{nonce}}"],
    },
  }
  ```

To add a nonce to a directive (See [Feature Compatibility](#feature-compatibility)), include the `"{{nonce}}"` placeholder in the list of sources.

### `appwardenApiToken`

The Appwarden API token used to authenticate requests to the Appwarden API. See the
[API token management guide](https://appwarden.io/docs/guides/api-token-management) for details on creating and
managing your token.

Treat this token as a secret (similar to a password): do not commit it to source control and store
it in environment variables or secret management where possible. Appwarden stores API tokens using
AES-GCM encryption and does not display them after creation.

### `cacheUrl` (Vercel only)

The URL or connection string of the cache provider (for example, Upstash or Vercel Edge Config)
that stores the quarantine status for your domain. See the
[Vercel integration guide](https://appwarden.io/docs/guides/vercel-middleware-integration#3-configure-a-cache-provider)
for cache provider configuration details.

### `vercelApiToken` (Vercel only)

A Vercel API token that Appwarden uses to manage the Vercel Edge Config cache provider that synchronizes the quarantine status of your domain.
See the [Vercel integration guide](https://appwarden.io/docs/guides/vercel-middleware-integration#3-configure-a-cache-provider)
for cache provider configuration details.

Appwarden never stores or logs your Vercel API token; it is used only to manage the quarantine status cache for your domain.

## Installation

Compatible with websites powered by [Cloudflare](https://developers.cloudflare.com/workers/static-assets/) or [Vercel](https://vercel.com).

For more background and advanced configuration, see the [Appwarden documentation](https://appwarden.io/docs).

### 1. Cloudflare

#### 1.1 Universal Middleware (direct Cloudflare Worker usage)

The **Universal Middleware** (`@appwarden/middleware/cloudflare`) is the recommended way to install Appwarden on Cloudflare. The easiest way to deploy this universal middleware is via our [build-cloudflare-action](https://github.com/appwarden/build-cloudflare-action); see the [Cloudflare integration guide](https://appwarden.io/docs/guides/cloudflare-middleware-integration#1-set-up-the-github-actions-workflow) for workflow details. If you prefer to manage your own Cloudflare Worker instead of using the GitHub Action, you can mount the universal Cloudflare middleware directly using the `@appwarden/middleware/cloudflare` bundle:

```ts
// src/worker.ts
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare"

const appwardenHandler = createAppwardenMiddleware((cloudflare) => ({
  debug: cloudflare.env.DEBUG === "true",
  lockPageSlug: cloudflare.env.LOCK_PAGE_SLUG,
  appwardenApiToken: cloudflare.env.APPWARDEN_API_TOKEN,
  contentSecurityPolicy: {
    mode: cloudflare.env.CSP_MODE,
    directives: cloudflare.env.CSP_DIRECTIVES,
  },
}))

export default {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return appwardenHandler(request, env, ctx)
  },
}
```

See the Cloudflare integration docs on [appwarden.io](https://appwarden.io/docs) for environment variable setup and deployment details.

#### 1.2 Cloudflare framework adapters

If you cannot use `build-cloudflare-action`, you can mount Appwarden inside your application using framework-specific adapters.

> Currently, framework adapters do not automatically reflect your Appwarden domain configuration. You must manually provide the `lockPageSlug` and `contentSecurityPolicy` configuration in your code.

##### Astro on Cloudflare

```ts
// src/middleware.ts
import { sequence } from "astro:middleware"
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/astro"

const appwarden = createAppwardenMiddleware((cloudflare) => ({
  lockPageSlug: cloudflare.env.APPWARDEN_LOCK_PAGE_SLUG,
  appwardenApiToken: cloudflare.env.APPWARDEN_API_TOKEN,
  debug: cloudflare.env.APPWARDEN_DEBUG === "true",
  contentSecurityPolicy: {
    mode: "enforced",
    directives: {
      "script-src": ["'self'", "{{nonce}}"],
      "style-src": ["'self'", "{{nonce}}"],
    },
  },
}))

export const onRequest = sequence(appwarden)
```

See the [Astro + Cloudflare guide](https://appwarden.io/docs/guides/astro-cloudflare) for more details.

##### React Router on Cloudflare

```ts
// app/root.tsx
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/react-router"
import type { CloudflareContext } from "@appwarden/middleware/cloudflare/react-router"

export const unstable_middleware = [
  createAppwardenMiddleware((cloudflare: CloudflareContext) => ({
    lockPageSlug: cloudflare.env.APPWARDEN_LOCK_PAGE_SLUG,
    appwardenApiToken: cloudflare.env.APPWARDEN_API_TOKEN,
    debug: cloudflare.env.APPWARDEN_DEBUG === "true",
    contentSecurityPolicy: {
      mode: "enforced",
      directives: {
        "script-src": ["'self'", "{{nonce}}"],
        "style-src": ["'self'", "{{nonce}}"],
      },
    },
  })),
]
```

See the [React Router + Cloudflare guide](https://appwarden.io/docs/guides/react-router-cloudflare) for full usage and context setup.

##### TanStack Start on Cloudflare

```ts
// src/start.ts
import { createStart } from "@tanstack/react-start"
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/tanstack-start"
import type { TanStackStartCloudflareContext } from "@appwarden/middleware/cloudflare/tanstack-start"

const appwardenMiddleware = createAppwardenMiddleware(
  (cloudflare: TanStackStartCloudflareContext) => ({
    lockPageSlug: cloudflare.env.APPWARDEN_LOCK_PAGE_SLUG,
    appwardenApiToken: cloudflare.env.APPWARDEN_API_TOKEN,
    debug: cloudflare.env.APPWARDEN_DEBUG === "true",
    contentSecurityPolicy: {
      mode: "enforced",
      directives: {
        "script-src": ["'self'", "{{nonce}}"],
        "style-src": ["'self'", "{{nonce}}"],
      },
    },
  }),
)

export const start = createStart(() => ({
  requestMiddleware: [appwardenMiddleware],
}))
```

See the [TanStack Start + Cloudflare guide](https://appwarden.io/docs/guides/tanstack-start-cloudflare) for more details.

##### Next.js on Cloudflare (OpenNext)

```ts
// middleware.ts or proxy.ts
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/nextjs"

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

export default createAppwardenMiddleware((cloudflare) => ({
  lockPageSlug: cloudflare.env.APPWARDEN_LOCK_PAGE_SLUG,
  appwardenApiToken: cloudflare.env.APPWARDEN_API_TOKEN,
  debug: cloudflare.env.APPWARDEN_DEBUG === "true",
  // Headers-only CSP (no HTML rewriting, no nonce support; do not use `{{nonce}}` here)
  contentSecurityPolicy: {
    mode: "report-only",
    directives: {
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
}))
```

This adapter applies CSP **headers only** before origin (no HTML rewriting, no nonce injection). Nonce-based CSP (`{{nonce}}`) is **not supported** in this adapter; CSP directives must not include `{{nonce}}`.

### 2. Vercel

To use Appwarden as Vercel Edge Middleware, use the `@appwarden/middleware/vercel` bundle:

```ts
// middleware.ts (Next.js app on Vercel)
import { createAppwardenMiddleware } from "@appwarden/middleware/vercel"
import type { VercelMiddlewareFunction } from "@appwarden/middleware/vercel"

const appwardenMiddleware: VercelMiddlewareFunction = createAppwardenMiddleware(
  {
    // Edge Config or Upstash KV URL
    cacheUrl: process.env.APPWARDEN_CACHE_URL!,
    // Required when using Vercel Edge Config
    vercelApiToken: process.env.APPWARDEN_VERCEL_API_TOKEN!,
    appwardenApiToken: process.env.APPWARDEN_API_TOKEN!,
    lockPageSlug: "/maintenance",
    contentSecurityPolicy: {
      mode: "report-only",
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  },
)

export default appwardenMiddleware
```

Nonce-based CSP (`{{nonce}}`) is **not supported** in Vercel Edge Middleware; CSP directives must not include `{{nonce}}`.

## Supported platforms

- [All websites on Cloudflare](https://appwarden.io/docs/guides/cloudflare-middleware-integration)
  - [Astro on Cloudflare](https://appwarden.io/docs/guides/astro-cloudflare)
  - [React Router on Cloudflare](https://appwarden.io/docs/guides/react-router-cloudflare)
  - [TanStack Start on Cloudflare](https://appwarden.io/docs/guides/tanstack-start-cloudflare)
  - [Next.js on Cloudflare (OpenNext)](https://appwarden.io/docs/guides/nextjs-cloudflare)
- [All websites on Vercel](https://appwarden.io/docs/guides/vercel-integration)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using the [Conventional Commits](https://www.conventionalcommits.org/) format
   - This project enforces commit message format with commitlint
   - Examples:
     - `feat: add new feature`
     - `fix: resolve issue with X`
     - `docs: update README`
     - `chore: update dependencies`
     - `refactor: improve code structure`
     - `test: add tests for feature X`
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test
```

## Security

Please review our [security policy](SECURITY.md) for details on how we handle vulnerabilities and how to report a security issue.

This package is published with npm trusted publishers, to prevent npm token exfiltration, and provenance enabled, which provides a verifiable link between the published package and its source code. For more information, see [npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

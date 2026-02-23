# @appwarden/middleware

[![GitHub](https://img.shields.io/badge/GitHub-appwarden%2Fmiddleware-181717?logo=github&logoColor=white)](https://github.com/appwarden/middleware)
[![npm version](https://img.shields.io/npm/v/@appwarden/middleware.svg)](https://www.npmjs.com/package/@appwarden/middleware)
[![npm provenance](https://img.shields.io/badge/npm-provenance-green)](https://docs.npmjs.com/generating-provenance-statements)
![Test Coverage](https://img.shields.io/badge/coverage-95.72%25-brightgreen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Read the docs [to learn more](https://appwarden.io/docs)

## Stop in progress attacks in their tracks

### Core Features

- **Instant Quarantine**: Immediately redirects all visitors to a lock page when activated
- **Discord Integration**: Trigger lockdowns via Discord commands (`/quarantine lock your.app.io`)
- **Nonce-based Content Security Policy (Cloudflare only)**: Deploy a nonce-based Content Security Policy to supercharge your website security
- **Minimal Runtime Overhead**: Negligible performance impact by using `event.waitUntil` for status checks

## Installation

Compatible with websites powered by [Cloudflare](https://developers.cloudflare.com/workers/static-assets/) or [Vercel](https://vercel.com).

For more background and advanced configuration, see the [Appwarden documentation](https://appwarden.io/docs).

### 1. Cloudflare

#### 1.1 Universal Middleware (direct Cloudflare Worker usage)

The **Universal Middleware** (`@appwarden/middleware/cloudflare`) is the recommended way to install Appwarden on Cloudflare. The easiest way to deploy this universal middleware is via our [build-cloudflare-action](https://github.com/appwarden/build-cloudflare-action); see the [Cloudflare integration guide](https://appwarden.io/docs/guides/cloudflare-middleware-integration#1-set-up-the-github-actions-workflow) for workflow details. If you prefer to manage your own Cloudflare Worker instead of using the GitHub Action, you can mount the universal Cloudflare middleware directly using the `@appwarden/middleware/cloudflare` bundle:

```ts
// src/worker.ts
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare"

const appwardenHandler = createAppwardenMiddleware((context) => ({
  debug: context.env.DEBUG === "true",
  lockPageSlug: context.env.LOCK_PAGE_SLUG,
  appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
  appwardenApiHostname: context.env.APPWARDEN_API_HOSTNAME,
  contentSecurityPolicy: {
    mode: context.env.CSP_MODE,
    directives: context.env.CSP_DIRECTIVES,
  },
}))

export default {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return appwardenHandler(request, env, ctx)
  },
}
```

    - `lockPageSlug` controls where users are redirected when the site is quarantined. See [Configuration](#configuration) for details.
    - `CSP_MODE` and `CSP_DIRECTIVES` configure a nonce-based Content Security Policy that runs **after** origin rendering (when HTML rewriting is available). See [Configuration](#configuration) for CSP modes and directives.

See the Cloudflare integration docs on [appwarden.io](https://appwarden.io/docs) for environment variable setup and deployment details.

#### 1.2 Cloudflare framework adapters

If you cannot use `build-cloudflare-action`, you can mount Appwarden inside your application using framework-specific adapters.

> Currently, framework adapters do not automatically reflect your Appwarden domain configuration. You must manually provide the `lockPageSlug` and `contentSecurityPolicy` configuration in your code.

##### Astro on Cloudflare

```ts
// src/middleware.ts
import { sequence } from "astro:middleware"
import { createAppwardenMiddleware } from "@appwarden/middleware/cloudflare/astro"

const appwarden = createAppwardenMiddleware(({ env }) => ({
  lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
  appwardenApiToken: env.APPWARDEN_API_TOKEN,
  appwardenApiHostname: env.APPWARDEN_API_HOSTNAME,
  debug: env.APPWARDEN_DEBUG === "true",
  contentSecurityPolicy: {
    hostname: "www.example.com",
    mode: "enforced",
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "{{nonce}}"],
      "style-src": ["'self'", "{{nonce}}"],
      "img-src": ["'self'", "data:"],
      "connect-src": ["'self'", "https://api.appwarden.io"],
      "report-uri": ["https://csp-reports.example.com/astro"],
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
    appwardenApiHostname: cloudflare.env.APPWARDEN_API_HOSTNAME,
    debug: cloudflare.env.APPWARDEN_DEBUG === "true",
    contentSecurityPolicy: {
      hostname: "app.example.com",
      mode: "enforced",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "{{nonce}}"],
        "style-src": ["'self'", "{{nonce}}"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://api.appwarden.io"],
        "report-uri": ["https://csp-reports.example.com/react-router"],
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
    appwardenApiHostname: cloudflare.env.APPWARDEN_API_HOSTNAME,
    debug: cloudflare.env.APPWARDEN_DEBUG === "true",
    contentSecurityPolicy: {
      hostname: "start.example.com",
      mode: "enforced",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "{{nonce}}"],
        "style-src": ["'self'", "{{nonce}}"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://api.appwarden.io"],
        "report-uri": ["https://csp-reports.example.com/tanstack"],
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

export default createAppwardenMiddleware(({ env }) => ({
  lockPageSlug: env.APPWARDEN_LOCK_PAGE_SLUG,
  appwardenApiToken: env.APPWARDEN_API_TOKEN,
  appwardenApiHostname: env.APPWARDEN_API_HOSTNAME,
  debug: env.APPWARDEN_DEBUG === "true",
  // Headers-only CSP (no HTML rewriting)
  contentSecurityPolicy: {
    hostname: "next.example.com",
    mode: "report-only",
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:"],
      "connect-src": ["'self'", "https://api.appwarden.io"],
      "report-uri": ["https://csp-reports.example.com/opennext"],
    },
  },
}))
```

This adapter applies CSP **headers only** before origin (no HTML rewriting, no nonce injection). See the [Next.js + Cloudflare guide](https://appwarden.io/docs/guides/nextjs-cloudflare) for more.

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
    // Required Appwarden API token
    appwardenApiToken: process.env.APPWARDEN_API_TOKEN!,
    // Required when using Vercel Edge Config
    vercelApiToken: process.env.APPWARDEN_VERCEL_API_TOKEN!,
    // Path to your lock page
    lockPageSlug: "/lock",
    // Optional CSP (no nonce support on Vercel Edge Middleware)
    contentSecurityPolicy: {
      mode: "report-only",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://api.appwarden.io"],
        "report-uri": ["https://csp-reports.example.com/vercel"],
      },
    },
  },
)

export default appwardenMiddleware
```

Nonce-based CSP (`{{nonce}}`) is **not supported** in Vercel Edge Middleware; CSP directives must not include `{{nonce}}`. See the [Vercel integration guide](https://appwarden.io/docs/guides/vercel-integration) for full details.

## Configuration

The following options are shared across the Cloudflare and Vercel middleware bundles.

### `lockPageSlug`

The path or route (for example, `/lock`) to redirect users to when the domain is quarantined.
This should be a working page on your site, such as a maintenance or status page, that
explains why the website is temporarily unavailable.

### `contentSecurityPolicy`

Controls the Content Security Policy (CSP) headers that Appwarden adds.

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
      "default-src": ["'self'"],
      "script-src": ["'self'", "{{nonce}}"],
    },
  }
  ```

  To add a nonce to a directive (Cloudflare adapters only), include the `"{{nonce}}"` placeholder
  in the list of sources. On Vercel Edge Middleware, nonces are not supported and `"{{nonce}}"`
  must not be used.

  Commonly used directives include: `default-src`, `script-src`, `style-src`, `img-src`,
  `connect-src`, `font-src`, `object-src`, `media-src`, `frame-src`, `sandbox`, `report-uri`,
  `child-src`, `form-action`, `frame-ancestors`, `plugin-types`, `base-uri`, `report-to`,
  `worker-src`, `manifest-src`, `prefetch-src`, `navigate-to`, `require-sri-for`,
  `block-all-mixed-content`, `upgrade-insecure-requests`, `trusted-types`, and
  `require-trusted-types-for`.

### `cacheUrl` (Vercel only)

The URL or connection string of the cache provider (for example, Upstash or Vercel Edge Config)
that stores the quarantine status for your domain. See the
[Vercel integration guide](https://appwarden.io/docs/guides/vercel-middleware-integration#3-configure-a-cache-provider)
for cache provider configuration details.

### `vercelApiToken` (Vercel only)

A Vercel API token that Appwarden uses to manage the cache (for example, Upstash or Vercel Edge
Config) that synchronizes the quarantine status of your domain.

Appwarden never stores or logs your Vercel API token; it is used only to manage the quarantine
status cache for your domain.

### `appwardenApiToken`

The Appwarden API token used to authenticate requests to the Appwarden API. See the
[API token management guide](https://appwarden.io/docs/guides/api-token-management) for details on creating and
managing your token.

Treat this token as a secret (similar to a password): do not commit it to source control and store
it in environment variables or secret management where possible. Appwarden stores API tokens using
AES-GCM encryption and does not display them in Discord.

## Supported websites

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

---
name: appwarden-middleware-cloudflare-adapters
description: >
  Add @appwarden/middleware to Cloudflare adapter projects: Astro, React Router, TanStack Start, and Next.js (OpenNext). Covers appwarden-link, middleware file placement, getAppwardenConfiguration, and the CSP/adapter capability matrix. Load this skill when a user is wiring Appwarden into a Cloudflare framework adapter.
metadata:
  type: framework
  library: "@appwarden/middleware"
  library_version: "3.16.3"
requires:
  - "appwarden-middleware-get-started"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/guides/cloudflare-middleware-integration.mdx"
  - "appwarden/middleware:src/adapters/"
  - "appwarden/middleware:src/bundles/cloudflare.ts"
---

# Appwarden Middleware — Wire into Cloudflare Adapters

Cloudflare framework adapters run middleware inside your application. Install `@appwarden/middleware`, run `appwarden-link` at build time, and import the generated `.appwarden/linked/middleware.json` configuration.

## Setup

1. Add the package:

```bash
npm install @appwarden/middleware
```

2. Add `appwarden-link` as a prebuild script:

```json
{
  "scripts": {
    "prebuild": "appwarden-link --fqdn=your.app"
  }
}
```

3. Add `.appwarden/linked/` to `.gitignore`.
4. Create the adapter-specific middleware file shown below for your framework.

## Core Patterns

### Astro Cloudflare adapter

```typescript
// src/middleware.ts
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

### React Router Cloudflare adapter

```typescript
// react-router.config.ts
export default {
  ssr: true,
  future: {
    v8_middleware: true,
  },
}
```

```typescript
// app/root.tsx
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

### TanStack Start Cloudflare adapter

```typescript
// app.config.ts or app/ssr.tsx
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

### Next.js Cloudflare (OpenNext) adapter

Next.js 15 and earlier:

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

Next.js 16+ uses `proxy.ts` instead of `middleware.ts`:

```typescript
// proxy.ts
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
```

## Common Mistakes

### CRITICAL Forgetting the appwarden-link prebuild step

Wrong:

```json
{
  "scripts": { "build": "astro build" }
}
```

Correct:

```json
{
  "scripts": {
    "prebuild": "appwarden-link --fqdn=your.app",
    "build": "astro build"
  }
}
```

Without `appwarden-link`, `.appwarden/linked/middleware.json` is missing or stale, and the adapter cannot read the lock page or CSP configuration from the dashboard.

### HIGH Lifecycle scripts disabled in npm or pnpm

Wrong:

```text
// .npmrc
ignore-scripts=true

// build command does not explicitly call appwarden-link
```

Correct:

```text
// .npmrc
ignore-scripts=false

// or invoke the script explicitly before the framework build
appwarden-link --fqdn=your.app && astro build
```

When `ignore-scripts` is set to `true`, `prebuild` scripts are skipped automatically. The framework build then runs without the generated `.appwarden/linked/middleware.json` file.

### MEDIUM Committing .appwarden/linked/ to source control

Wrong:

```text
// .appwarden/linked/middleware.json tracked in git
```

Correct:

```text
// .gitignore
.appwarden/linked/
```

The generated file is produced at build time and should not be committed.

### HIGH Using nonce-based CSP on the Next.js Cloudflare adapter

Wrong:

```yaml
csp-mode: enforced
csp-directives:
  script-src:
    - "'self'"
    - "{{nonce}}"
```

Correct:

```yaml
csp-mode: enforced
csp-directives:
  script-src:
    - "'self'"
```

The OpenNext adapter applies CSP headers only before the origin; it does not rewrite HTML to inject nonces. Use headers-only CSP directives for this adapter.

### HIGH Placing Next.js middleware.ts at the project root when the app uses src/ layout

Wrong:

```text
// websites/appwarden-io/landing/middleware.ts
// app uses src/app layout
```

Correct:

```text
// websites/appwarden-io/landing/src/middleware.ts
```

Next.js only loads `middleware.ts` from the project root or from `src/` depending on the layout. A misplaced file means the middleware never runs.

### HIGH Using middleware.ts instead of proxy.ts for Next.js 16+

Wrong:

```text
// middleware.ts in a Next.js 16+ project
```

Correct:

```text
// proxy.ts in a Next.js 16+ project
```

Next.js 16 renamed middleware to `proxy.ts`. A `middleware.ts` file is silently ignored in Next.js 16+ projects.

### HIGH Forgetting the v8_middleware flag in React Router config

Wrong:

```typescript
export default { ssr: true }
```

Correct:

```typescript
export default {
  ssr: true,
  future: { v8_middleware: true },
}
```

React Router ignores middleware exports unless `future.v8_middleware: true` is set. Without it, Appwarden never runs.

### MEDIUM Serving the lock page without the configured CSP headers

Both the Vercel runner and the Next.js Cloudflare adapter short-circuit with `NextResponse.next()` when the request is already on the lock page, bypassing CSP header injection. Apply CSP at the framework/page level for the lock page, or accept that the lock page may not receive middleware CSP headers.

## Next Steps

- For CSP on Cloudflare, see `appwarden-middleware-csp`.
- For Vercel instead of Cloudflare, see `appwarden-middleware-vercel-edge`.
- For standalone Cloudflare Worker, see `appwarden-middleware-cloudflare-workflow`.

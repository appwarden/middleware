---
name: appwarden-middleware-lock-page
description: >
  Build a neutral maintenance-style lock page, route it in the target framework, and connect it to Appwarden via lockPageSlug. Provides a minimal HTML/JSX template that works on Cloudflare and Vercel. Load this skill when a user is setting up their first lock page.
metadata:
  type: core
  library: "@appwarden/middleware"
  library_version: "3.16.3"
sources:
  - "appwarden/middleware:src/schemas/helpers.ts"
  - "appwarden/middleware:README.md"
---

# Appwarden Middleware — Create and Configure Lock Page

A lock page is the page users see when a domain is quarantined. It must exist as a real route, use neutral maintenance language, and link back to the homepage. This skill provides a minimal template and shows how to wire it to `lockPageSlug`.

## Setup

1. Create a route in your framework at the path you want to use for the lock page (for example, `/maintenance`).
2. Add a page component that returns the lock page template below.
3. Set `lockPageSlug` in the middleware to match that path.

## Core Patterns

### Minimal lock page template (HTML/JSX)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Maintenance</title>
  </head>
  <body>
    <main>
      <h1>We’re doing maintenance</h1>
      <p>We’ll be back online soon.</p>
      <p><a href="/">Return to homepage</a></p>
    </main>
  </body>
</html>
```

### Next.js lock page example

```typescript
// app/maintenance/page.tsx
export default function MaintenancePage() {
  return (
    <main>
      <h1>We’re doing maintenance</h1>
      <p>We’ll be back online soon.</p>
      <p><a href="/">Return to homepage</a></p>
    </main>
  )
}
```

### Astro lock page example

```astro
---
// src/pages/maintenance.astro
---
<html lang="en">
  <head>
    <title>Maintenance</title>
  </head>
  <body>
    <main>
      <h1>We’re doing maintenance</h1>
      <p>We’ll be back online soon.</p>
      <p><a href="/">Return to homepage</a></p>
    </main>
  </body>
</html>
```

### Wire lockPageSlug to the route

```typescript
import {
  createAppwardenMiddleware,
  getAppwardenConfiguration,
} from "@appwarden/middleware/cloudflare"
import appwardenConfig from "../.appwarden/linked/middleware.json"

export default createAppwardenMiddleware((cloudflare) =>
  getAppwardenConfiguration(appwardenConfig, {
    appwardenApiToken: cloudflare.env.APPWARDEN_API_TOKEN,
    lockPageSlug: "/maintenance",
  }),
)
```

## Common Mistakes

### HIGH Configuring a lockPageSlug that does not exist as a route

Wrong:

```typescript
lockPageSlug: "/lockdown"
// but /lockdown is not a real route in the app
```

Correct:

```typescript
lockPageSlug: "/maintenance"
// with a real /maintenance page in the framework
```

If the lock page route is missing, quarantined visitors receive a 404 instead of the maintenance page.

### MEDIUM Using incident-specific or alarming messaging on the lock page

Wrong:

```html
<h1>Site compromised — emergency lockdown</h1>
```

Correct:

```html
<h1>We’re doing maintenance</h1>
<p>We’ll be back online soon. <a href="/">Return home</a></p>
```

Appwarden guidance is to use neutral language. Alarming messaging can create unnecessary panic and leak incident details.

### MEDIUM Providing an absolute URL or protocol-relative lockPageSlug

Wrong:

```typescript
lockPageSlug: "https://example.com/maintenance"
```

Correct:

```typescript
lockPageSlug: "/maintenance"
```

`lockPageSlug` must be a relative path. The schema rejects values containing `://`, starting with `//`, or containing backslashes.

## Next Steps

After the lock page is wired, test quarantine behavior: see `appwarden-middleware-quarantine`.

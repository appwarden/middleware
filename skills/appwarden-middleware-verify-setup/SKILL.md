---
name: appwarden-middleware-verify-setup
description: >
  Run pre-launch verification, domain verification, incident simulation, and troubleshooting steps for Appwarden middleware on Cloudflare or Vercel. Covers the heartbeat endpoint, dashboard domain verification, quarantine tests, platform logs, and debug cleanup. Load this skill before taking a domain to production with Appwarden.
metadata:
  type: lifecycle
  library: "@appwarden/middleware"
  library_version: "3.16.3"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/getting-started/verify-setup.mdx"
  - "appwarden/middleware:examples/bug-reports-nextjs-cloudflare.md"
  - "appwarden/middleware:examples/bug-reports-vercel.md"
---

# Appwarden Middleware — Verify Setup Before Production

Run this checklist in staging before enabling Appwarden in production. A clean verification confirms the middleware runs on every relevant route, the lock page works, and the API token is correctly scoped.

## Setup

1. Deploy the middleware with `debug: true`.
2. Ensure the Appwarden dashboard shows the domain as verified.
3. Have the Discord bot and command permissions configured, or know the dashboard URL for manual lock/unlock.

## Core Patterns

### Pre-launch checklist

- [ ] Heartbeat endpoint returns no `configErrors`:

```bash
curl https://example.com/_appwarden/heartbeat
```

- [ ] Dashboard shows the domain as verified:
  - Open `https://use.appwarden.io/?to=/`.
  - Navigate to Settings > Monitoring.
  - Confirm the Domain Verification card shows a green checkmark.

- [ ] `/quarantine test` shows the lock page at `https://example.com/_appwarden/test`.
- [ ] `/incident test` on a test domain behaves as expected.
- [ ] Unlock restores normal traffic.
- [ ] Middleware runs on every relevant HTML route (not just the homepage).
- [ ] Platform logs show no Appwarden errors.
- [ ] Switch `debug` to `false` after the checklist is clean.

### Inspect platform logs

**Cloudflare:**

```bash
wrangler tail appwarden-production
```

Or in the dashboard: Workers & Pages > `appwarden-production` > Logs.

**Vercel:**

Project dashboard > Functions / Edge Middleware logs.

### Switch debug off after validation

```typescript
debug: false
```

Only disable debug after the heartbeat is clean and all tests pass. Debug logs are the primary signal for config errors during first setup.

### Understand what quarantine covers

Appwarden quarantines HTML requests. Non-HTML requests such as API routes, `_next/static`, and image assets pass through the middleware without being checked. Protect API routes separately if they must be blocked during an incident.

## Common Mistakes

### MEDIUM Switching debug to false before confirming the heartbeat is clean

Wrong:

```typescript
debug: false
```

Correct:

```typescript
debug: true
// Check /_appwarden/heartbeat for configErrors, then set debug: false
```

Debug logs expose config errors and lock-status checks. Disabling them too early hides problems.

### MEDIUM Not inspecting build and deploy logs for appwarden-link errors

Wrong:

```text
// Deploy and hope the link step worked
```

Correct:

```text
// Review build logs for appwarden-link output
// Verify .appwarden/linked/middleware.json is generated
```

For Cloudflare framework adapters, `appwarden-link` syncs the dashboard configuration. If it fails, the generated config is stale or missing.

### MEDIUM Not checking the correct platform logs for middleware errors

Wrong:

```text
// Only look at application logs
```

Correct:

```text
// Cloudflare: Workers & Pages > appwarden-production > Logs
// Vercel: Project dashboard > Functions/Edge Middleware logs
```

### MEDIUM Assuming non-HTML requests are quarantined like HTML requests

Wrong:

```text
// Expect API routes to be blocked during quarantine
```

Correct:

```text
// Quarantine only redirects HTML requests
// Protect API routes separately if needed
```

### MEDIUM Assuming the domain is verified without checking the dashboard

Wrong:

```text
// Deploy the middleware and assume the domain is verified
```

Correct:

```text
// Open https://use.appwarden.io/?to=/ > Settings > Monitoring
// Wait for the green checkmark
```

Domain verification is automatic only after a successful heartbeat. The dashboard must be checked to confirm the status changed from pending to verified.

## Next Steps

After verification, the domain is ready for production use. Keep the API token secure and rehearse the quarantine flow regularly.

- For quarantine commands: see `appwarden-middleware-quarantine`.
- For token management: see `appwarden-middleware-api-token`.

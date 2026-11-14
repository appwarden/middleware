---
name: appwarden-middleware-verify-setup
description: >
  Run pre-launch verification, domain verification, monitor deployment review, incident simulation, and troubleshooting steps for Appwarden middleware on Cloudflare or Vercel. Covers the heartbeat endpoint, dashboard domain verification, Monitors page states, quarantine tests, platform logs, and debug cleanup. Load this skill before taking a domain to production with Appwarden.
metadata:
  type: lifecycle
  library: "@appwarden/middleware"
  library_version: "3.17.15"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/getting-started/verify-setup.mdx"
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/guides/monitor-deployments.mdx"
  - "appwarden/middleware:examples/bug-reports-nextjs-cloudflare.md"
  - "appwarden/middleware:examples/bug-reports-vercel.md"
---

# Appwarden Middleware — Verify Setup Before Production

Run this checklist in staging before enabling Appwarden in production. A clean verification confirms the middleware runs on every relevant route, the lock page works, and the API token is correctly scoped.

## Setup

1. Deploy the middleware with `debug: true`.
2. Confirm the organization's subscription is live. Without one, `/v1/appwarden/*` answers `402 SUBSCRIPTION_REQUIRED` and the middleware will not enforce lock or unlock.
3. Ensure the Appwarden dashboard shows the domain as verified.
4. Have the Discord bot and command permissions configured, or know the dashboard URL for manual lock/unlock.

## Core Patterns

### Pre-launch checklist

- [ ] Heartbeat endpoint returns no `configErrors`:

```bash
curl https://example.com/_appwarden/heartbeat
```

- [ ] Dashboard shows the domain as verified:
  - Open `https://use.appwarden.io/?to=/`.
  - Navigate to Settings > Security.
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

### Read the Monitors page

The dashboard's **Monitors** page lists one card per hostname in the domain configuration. Appwarden deploys one monitor per hostname — a Cloudflare Worker that reports changes to that hostname's DNS records and website responses — so the page is the deployment-side counterpart to the heartbeat check.

Each card shows the **Status**, the **Hostname** (linking to the live site), the deployed **Version**, a link to the domain configuration file at the commit that last deployed the monitor, the **Active incidents**, and a **Last attempt** timestamp that appears only on failures.

| Status                    | Meaning                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **Healthy**               | Deployed, no check failing                                                                       |
| **Alerting**              | Deployed, at least one incident active                                                           |
| **Deploying**             | A deployment is in progress, including a retry                                                   |
| **Failed**                | The deployment did not complete; Appwarden retries it, and **Last attempt** shows the last try   |
| **Pending deletion**      | The hostname is gone from the configuration; the deletion is queued                              |
| **Deleted**               | The deletion completed and the Worker is gone. Final state, not a failure                        |
| **Deletion failed**       | The deletion did not complete; the deletion job retries, and **Last attempt** shows the last try |
| **Verification Required** | A button, not a badge: the domain is unverified, so the monitor cannot check it                  |

**Healthy** and **Alerting** both mean deployed; which one shows depends on whether an incident is open. Filter the page by **All monitors**, **Deploying**, **Healthy**, or **Issue**.

### Understand how a monitor is deleted or retried

There is no delete button. Removing a hostname is a configuration change: drop the hostname's configuration file (or its `monitors` entries), merge to the default branch, and the card moves through **Pending deletion** to **Deleted**. Neither state needs anything from you.

Both the deploy and the deletion pipelines retry rather than give up. A repeated **Failed** or **Deletion failed** is not transient, so read **Last attempt** before intervening: a monitor that failed once is a different problem from one that has been failing for hours. A failed deploy means the hostname is not monitored and no incident can be raised against it — start with the pull request that deployed it and the workflow run in the domain configuration repository, since a configuration error is the usual cause.

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
// Open https://use.appwarden.io/?to=/ > Settings > Security
// Wait for the green checkmark
// Or follow the Verification Required button on the hostname's Monitors card
```

Domain verification is automatic only after a successful heartbeat. The dashboard must be checked to confirm the status changed from pending to verified, and an unverified domain also blocks its monitor from checking the site.

### MEDIUM Reading a failed monitor deployment as a transient blip, or waiting for one that will not recover

Wrong:

```text
// The Monitors card says Failed; assume the next deploy fixes it
```

Correct:

```text
// Appwarden already retries: read Last attempt to see how long it has been failing
// Then check the pull request and the workflow run in the domain configuration repository
```

**Failed** and **Deletion failed** are retried automatically, so a stale **Last attempt** means retries are not fixing it. A hostname with no successful deploy is not monitored, and no incident can be raised against it — a gap that is invisible until you read the Monitors page.

### MEDIUM Debugging lock and unlock behaviour while the subscription is not live

Wrong:

```text
// The site stops honouring lock and unlock; inspect the token and the CSP config
```

Correct:

```text
// Check Settings > Billing: a cancelled or missing subscription makes
// /v1/appwarden/* answer 402 SUBSCRIPTION_REQUIRED,
// and the middleware stops enforcing lock and unlock until it is restored
```

A `402` from the status route is a billing state, not a middleware, token, or configuration fault. Monitor deployments and pull request checks also stop while the subscription is missing. Restoring the subscription clears it without a redeploy.

## Next Steps

After verification, the domain is ready for production use. Keep the API token secure and rehearse the quarantine flow regularly.

- For quarantine commands: see `appwarden-middleware-quarantine`.
- For token management: see `appwarden-middleware-api-token`.

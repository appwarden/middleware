---
name: quarantine
description: >
  Quarantine, test, and unlock an Appwarden domain via Discord or the dashboard, and validate the behavior end-to-end. Covers required permissions, /_appwarden/test, /_appwarden/heartbeat, /incident test, and safe unlock. Load this skill when a user is rehearsing or running a real quarantine flow.
metadata:
  type: lifecycle
  library: appwarden-middleware
  library_version: "3.16.3"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/guides/roles-and-permissions.mdx"
  - "appwarden/middleware:src/constants.ts"
---

# Appwarden Middleware — Quarantine, Unlock, and Test a Domain

Use Appwarden to block all user interaction on a domain by serving the lock page. Test the flow in staging before relying on it during an incident.

## Setup

Before running quarantine commands, confirm:

1. The middleware is deployed and the heartbeat endpoint is clean.
2. The lock page exists and is reachable.
3. The user has the required dashboard permissions.

## Core Patterns

### Check required permissions

Dashboard permissions control who can run quarantine commands:

- **Lock / unlock a domain:** Manage Domains or Administer Domains
- **Test quarantine:** View Domains or higher

Discord command permissions are configured separately in Server Settings > Integrations > Appwarden. By default, only Server Administrators can run commands.

### Quarantine a domain from Discord

```text
/quarantine lock domain:example.com
```

Confirm the lock page appears at `https://example.com`.

### Unlock a domain from Discord

```text
/quarantine unlock domain:example.com
```

Confirm normal traffic resumes.

### Test from Discord and verify the test URL

```text
/quarantine test domain:example.com
```

Then open the browser at:

```text
https://example.com/_appwarden/test
```

You should see the lock page. Run the command again to disable the test lock.

### Simulate an incident on a test domain

```text
/incident test domain:example.com
```

This toggles the test lock state for incident rehearsal. Visit `/_appwarden/test` to confirm behavior.

### Use the dashboard instead of Discord

Open `https://use.appwarden.io/?to=/` to see the domain list. Each domain has controls for lock, unlock, and test when Discord is unavailable.

### Verify the heartbeat endpoint

```bash
curl https://example.com/_appwarden/heartbeat
```

A healthy response contains no `configErrors` and the expected `status`.

## Common Mistakes

### MEDIUM Testing quarantine only in the browser without checking the heartbeat endpoint

Wrong:

```text
// Only visually check the site
```

Correct:

```bash
curl https://example.com/_appwarden/heartbeat
```

The heartbeat endpoint exposes config errors and confirms the middleware is running.

### HIGH Forgetting to unlock after a staging test

Wrong:

```text
// Run /quarantine test, verify, then stop
```

Correct:

```text
// Run /quarantine unlock domain:example.com after the test
```

A domain remains locked until explicitly unlocked, blocking real users.

### HIGH Running quarantine commands without the required dashboard permissions

Wrong:

```text
// A Viewer role tries /quarantine lock in Discord
```

Correct:

```text
// Assign Editor/Admin or a custom role with Manage Domains before running quarantine commands
```

### MEDIUM Using /quarantine test but not checking /\_appwarden/test

Wrong:

```text
// Run /quarantine test and assume it works without visiting the URL
```

Correct:

```text
// Run /quarantine test, then open https://example.com/_appwarden/test in a browser
```

### MEDIUM Not knowing the dashboard URL for lock/unlock when Discord is unavailable

Wrong:

```text
// Searching for domain controls in Settings > Security
```

Correct:

```text
https://use.appwarden.io/?to=/
```

## Next Steps

After a successful test, run the full pre-launch verification checklist: see `appwarden-middleware-verify-setup`.

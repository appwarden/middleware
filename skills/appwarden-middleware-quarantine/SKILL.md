---
name: appwarden-middleware-quarantine
description: >
  Quarantine, test, and unlock an Appwarden domain via Discord or the dashboard, and validate the behavior end-to-end. Covers required permissions, /_appwarden/test, /_appwarden/heartbeat, /incident test, and safe unlock. Load this skill when a user is rehearsing or running a real quarantine flow.
metadata:
  type: lifecycle
  library: "@appwarden/middleware"
  library_version: "3.17.15"
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
4. The organization's subscription is live. A cancelled subscription disables every control that changes something — including lock, unlock, and test — and the API answers `402 SUBSCRIPTION_REQUIRED`, which makes the deployed middleware stop enforcing lock and unlock entirely.

## Core Patterns

### Check required permissions

Dashboard permissions control who can run quarantine commands:

- **Lock / unlock a domain:** Manage Domains or Administer Domains
- **Test quarantine:** View Domains or higher

Discord command permissions are configured separately in Server Settings > Integrations > Appwarden. By default, only Server Administrators can run commands.

### Know who can bring an incident responder in

The permission that lets someone run a quarantine command is not the permission that lets them grant it to someone else:

- **Manage Users** lets a member invite someone to the organization, and nothing more.
- **Administer Users** is required to edit an existing member's role or permissions, and to remove a member.

A member can only grant permissions they hold themselves. Appwarden enforces this in three places: the picker offers only the levels the actor's own membership reaches; when editing a member who already holds more than the actor does, those entries show checked and locked rather than hidden; and a request that adds a grant above the actor's reach is refused with `422` and `Cannot grant a permission you do not hold: '<permission>'`. Organization owners bypass the limit. An invitation is re-checked when it is accepted, so if the inviter lost a permission it carried, acceptance is refused rather than quietly narrowed — send a fresh invitation from someone who still holds it.

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

### MEDIUM Handing out a role the incident responder cannot grant, and reading the refusal as a bug

Wrong:

```text
// An Editor invites a colleague as Editor, then tries to grant Administer Domains
// Expect the change to save, or to be silently trimmed
```

Correct:

```text
// Manage Users invites; Administer Users edits roles and removes members
// A grant above your own reach is refused: 422 Cannot grant a permission you do not hold
// Ask an owner, or a member who holds the permission, to make the grant
```

Lock and unlock are driven by domain permissions, so the whole point of the invitation can fail if it is scoped by someone who cannot grant those permissions. The refusal names the permission in the message, so quote it back rather than guessing.

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

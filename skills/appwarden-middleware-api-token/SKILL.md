---
name: appwarden-middleware-api-token
description: >
  Create, rotate, and revoke Appwarden API tokens in the dashboard at Settings > Security. Store the token as a secret in Cloudflare, Vercel, or GitHub Actions, and map it to the APPWARDEN_API_TOKEN environment variable used by @appwarden/middleware. Load this skill when a user needs an API token or is troubleshooting token-related errors.
metadata:
  type: core
  library: "@appwarden/middleware"
  library_version: "3.17.4"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/guides/api-token-management.mdx"
  - "appwarden/middleware:src/schemas/helpers.ts"
---

# Appwarden Middleware — Manage API Token in Dashboard

The Appwarden API token is required by `@appwarden/middleware` to check lock status. Create it in the dashboard, copy it immediately, and store it as a secret in the platform where the middleware runs.

## Setup

1. Open the Appwarden dashboard at `https://use.appwarden.io/?to=/settings/security` (Settings > Security).
2. Under the API Token section, click **Create API Token**.
3. Copy the token immediately. It is shown only once. The token is a dual-token in the format `aw_<publicId>_<secret>`.
4. Store it in the target platform as `APPWARDEN_API_TOKEN`.
5. Return to the dashboard and trigger a quarantine test to confirm the token is reachable.

## Core Patterns

### Store in Cloudflare secrets

```bash
wrangler secret put APPWARDEN_API_TOKEN
```

Set `--env` if using [Cloudflare wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)

For CI/CD, use `cloudflare/wrangler-action` with the `secrets` input:

```yaml
- uses: cloudflare/wrangler-action@v4.0.0
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    environment: production
    secrets: |
      APPWARDEN_API_TOKEN
```

Set `environment` if using [Cloudflare wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
Do not store the token in `wrangler.json` under `vars`. Vars are plain text and visible in the dashboard.

### Store in Vercel environment variables

Add `APPWARDEN_API_TOKEN` in Project Settings > Environment Variables. Mark it as a secret (encrypts the value) and deploy to all affected environments.

### Store in GitHub Actions secrets

Add `APPWARDEN_API_TOKEN` to the repository secrets under Settings > Secrets and Variables > Actions. Reference it in workflows:

```yaml
env:
  APPWARDEN_API_TOKEN: ${{ secrets.APPWARDEN_API_TOKEN }}
```

### Rotate or revoke a token

1. Go to Settings > Security > API Token.
2. Delete the existing token. Deleted tokens remain valid for 5 minutes to allow safe replacement.
3. Create a new token and copy it immediately.
4. Update the secret in every environment that uses the old token.
5. Verify the middleware heartbeat is clean after the swap.

## Common Mistakes

### HIGH Creating the API token from the wrong URL or Discord

Wrong:

```text
// Looking for a Discord slash command like /token
```

Correct:

```text
https://use.appwarden.io/?to=/settings/security
```

There is no Discord command to create API tokens. Tokens are created only in the Appwarden dashboard at Settings > Security.

### CRITICAL Storing the API token in plaintext in the repository or Wrangler vars

Wrong:

```typescript
const appwardenApiToken = "aw_..."
```

Correct:

```typescript
// Vercel
const appwardenApiToken = process.env.APPWARDEN_API_TOKEN
// Cloudflare
import { env } from "cloudflare:workers"
const appwardenApiToken = env.APPWARDEN_API_TOKEN
```

The API token is equivalent to a password. Exposing it in code, env files committed to version control, or Wrangler vars risks account compromise and forces an emergency rotation.

### HIGH Not copying the token before closing the creation modal

Wrong:

```text
// Create the token and close the modal without copying
```

Correct:

```text
// Copy the token to a password manager or secret store before closing the modal
```

The token is shown only once. If lost, the only recovery is to delete the old token and create a new one, then update every environment that uses it.

### MEDIUM Trying to create a second token while one is already active

Wrong:

```text
// Click "Create API Token" while an existing token is still active
```

Correct:

```text
// Delete the existing token in Settings > Security, then create a new one
```

Each Appwarden organization can have only one active API token at a time. Create a new token only after deleting the current one.

### HIGH Reading a refusal as a token that needs checking when it needs rotating

The Appwarden API answers an expired token with `401` and `error.code: "TOKEN_EXPIRED"`, and a missing, malformed, or unknown token with an uncoded `401`. The two have different fixes.

Wrong:

```text
// 401 TOKEN_EXPIRED: re-copy the same token into every environment
```

Correct:

```text
// 401 TOKEN_EXPIRED: rotate the token in Settings > Security, then update every environment
```

An expired token is simply old; checking it against the dashboard confirms nothing. Rotate it.

### HIGH Reading a scope or domain refusal as "wait a few minutes"

A `403` with `error.code: "INSUFFICIENT_SCOPE"` means the token does not carry `read:domains` at all, so it can never read any domain. A `403` with `error.code: "DOMAIN_NOT_PERMITTED"` means the token's domain allowlist does not include this domain. Neither resolves by waiting — only a change in the dashboard does. Only an uncoded `403` is the unverified-domain state that resolves on its own ("Verifying domain ownership... this will only take a few minutes.").

Wrong:

```text
// 403 INSUFFICIENT_SCOPE: wait and retry the request
```

Correct:

```text
// 403 INSUFFICIENT_SCOPE: grant the token the read:domains scope at Settings > Security
// 403 DOMAIN_NOT_PERMITTED: add this domain to the token's allowlist at Settings > Security
```

### HIGH Treating a subscription refusal as a token problem

A `402` with `error.code: "SUBSCRIPTION_REQUIRED"` means the organization's billing is not live. The token is fine.

Wrong:

```text
// 402 SUBSCRIPTION_REQUIRED: recreate the API token
```

Correct:

```text
// 402 SUBSCRIPTION_REQUIRED: restore the organization's subscription at Settings > Billing
```

### MEDIUM Expecting the build to continue after a refusal

`appwarden-link` is fail-closed: a refused or unreachable Appwarden API ends the build rather than shipping without its remote configuration, because that configuration carries `lockPageSlug`, the CSP mode and directives, and the api route config. If a build must continue during an Appwarden outage, opt in to a degraded build explicitly.

Wrong:

```text
// A refused build silently continues and ships without its remote config
```

Correct:

```text
# Only when a degraded build is preferable to a failed one:
APPWARDEN_LINK_ALLOW_DEGRADED=1 appwarden-link --fqdn=your.app
# or: appwarden-link --fqdn=your.app --allow-degraded
```

Degraded mode warns and continues with local headers and defaults. It does not apply the remote configuration.

## Next Steps

After storing the token, wire it into the middleware: see `appwarden-middleware-get-started`.

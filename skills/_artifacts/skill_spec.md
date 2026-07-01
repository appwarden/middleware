# @appwarden/middleware — Skill Spec

@appwarden/middleware provides edge middleware for Cloudflare and Vercel that can instantly disable user interaction with a site by routing traffic to a lock page and enforcing CSP. It focuses on safe quarantine flows and configuration for Cloudflare adapters, standalone middleware, and Vercel Edge Middleware. This spec targets version 3.16.3 and incorporates setup notes, bug reports, source-level validation rules, and the official Appwarden integration and onboarding guides.

## Domains

| Domain                                | Description                                           | Skills                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Middleware integration                | Wiring Appwarden into Cloudflare and Vercel runtimes. | Get started with Appwarden middleware; Wire Appwarden into Cloudflare adapters; Standalone Cloudflare middleware with GitHub workflow; Wire Appwarden into Vercel Edge Middleware |
| Security & policy configuration       | Tokens, CSP, and lock page configuration.             | Manage Appwarden API token in dashboard; Configure nonce-based CSP on Cloudflare; Create and configure Appwarden lock page                                                        |
| Operations, testing & troubleshooting | Operating, testing, and debugging Appwarden setups.   | Onboard your Appwarden organization; Get started with Appwarden middleware; Quarantine, unlock, and test a domain; Verify setup before production and debug issues                |

## Skill Inventory

| Skill                                                 | Type      | Domain                                | What it covers                                                                                                                                         | Failure modes |
| ----------------------------------------------------- | --------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Onboard your Appwarden organization                   | lifecycle | Operations, testing & troubleshooting | Discord bot, GitHub App, domain configuration repo, dashboard onboarding                                                                               | 4             |
| Get started with Appwarden middleware                 | lifecycle | Operations, testing & troubleshooting | Install concurrently with onboarding, minimal config, first heartbeat, domain verification                                                             | 4             |
| Wire Appwarden into Cloudflare adapters               | framework | Middleware integration                | Astro, React Router, TanStack Start, Next.js/OpenNext adapter wiring, appwarden-link                                                                   | 8             |
| Standalone Cloudflare middleware with GitHub workflow | framework | Middleware integration                | Standalone Worker, deploy-appwarden.yml template, build and deploy steps, required secrets                                                             | 7             |
| Wire Appwarden into Vercel Edge Middleware            | framework | Middleware integration                | Vercel Edge Middleware, matcher/runtime, Upstash KV and Edge Config cache provider selection, Edge Config endpoint/reads, Deployment Protection bypass | 10            |
| Manage Appwarden API token in dashboard               | core      | Security & policy configuration       | Creating, rotating, and revoking API tokens (Settings > Security)                                                                                      | 4             |
| Configure nonce-based CSP on Cloudflare               | core      | Security & policy configuration       | Nonce CSP config, domain configuration file, redeploy workflow                                                                                         | 6             |
| Create and configure Appwarden lock page              | core      | Security & policy configuration       | Lock page route, UX, lockPageSlug validation                                                                                                           | 3             |
| Quarantine, unlock, and test a domain                 | lifecycle | Operations, testing & troubleshooting | Quarantine/test/unlock flows, heartbeat verification, Discord permissions, dashboard UI path                                                           | 5             |
| Verify setup before production and debug issues       | lifecycle | Operations, testing & troubleshooting | Pre-launch checklist, domain verification, incident simulation, debug cleanup                                                                          | 5             |

## Failure Mode Inventory

### Onboard your Appwarden organization (4 failure modes)

| #   | Mistake                                                                 | Priority | Source                      | Cross-skill? |
| --- | ----------------------------------------------------------------------- | -------- | --------------------------- | ------------ |
| 1   | Installing the GitHub App with access to all repositories               | HIGH     | organization-onboarding.mdx | —            |
| 2   | Not configuring Discord command permissions for security staff          | HIGH     | organization-onboarding.mdx | —            |
| 3   | Creating the domain configuration repository without using the template | MEDIUM   | organization-onboarding.mdx | —            |
| 4   | Skipping the repository selection step in the Appwarden dashboard       | MEDIUM   | organization-onboarding.mdx | —            |

### Get started with Appwarden middleware (4 failure modes)

| #   | Mistake                                                           | Priority | Source                         | Cross-skill? |
| --- | ----------------------------------------------------------------- | -------- | ------------------------------ | ------------ |
| 1   | Forgetting to provide APPWARDEN_API_TOKEN as a secret             | CRITICAL | src/schemas/helpers.ts, README | —            |
| 2   | Setting APPWARDEN_API_TOKEN as a Wrangler var instead of a secret | HIGH     | README                         | —            |
| 3   | Passing appwardenApiHostname to getAppwardenConfiguration         | HIGH     | src/schemas/helpers.ts         | —            |
| 4   | Leaving debug disabled during initial setup                       | MEDIUM   | src/schemas/use-appwarden.ts   | —            |

### Wire Appwarden into Cloudflare adapters (8 failure modes)

| #   | Mistake                                                                         | Priority | Source                                                                     | Cross-skill?                      |
| --- | ------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- | --------------------------------- |
| 1   | Forgetting the appwarden-link prebuild step for framework adapters              | CRITICAL | cloudflare-middleware-integration.mdx                                      | —                                 |
| 2   | Lifecycle scripts disabled in npm or pnpm                                       | HIGH     | npm/pnpm ignore-scripts behavior and cloudflare-middleware-integration.mdx | —                                 |
| 3   | Committing .appwarden/linked/ to source control                                 | MEDIUM   | cloudflare-middleware-integration.mdx                                      | —                                 |
| 4   | Using nonce-based CSP on the Next.js Cloudflare adapter                         | HIGH     | README, src/schemas/nextjs-cloudflare.ts                                   | configure-nonce-csp-on-cloudflare |
| 5   | Placing Next.js middleware.ts at the project root when the app uses src/ layout | HIGH     | cloudflare-middleware-integration.mdx                                      | —                                 |
| 6   | Using middleware.ts instead of proxy.ts for Next.js 16+                         | HIGH     | cloudflare-middleware-integration.mdx                                      | —                                 |
| 7   | Forgetting the v8_middleware flag in React Router config                        | HIGH     | cloudflare-middleware-integration.mdx                                      | —                                 |
| 8   | Serving the lock page without the configured CSP headers                        | MEDIUM   | examples/bug-reports-nextjs-cloudflare.md, examples/bug-reports-vercel.md  | —                                 |

### Standalone Cloudflare middleware with GitHub workflow (7 failure modes)

| #   | Mistake                                                                                              | Priority | Source                                                                                                      | Cross-skill? |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Forgetting the build step before deploying                                                           | CRITICAL | TEMPLATE--deploy-appwarden.yml                                                                              | —            |
| 2   | Setting CLOUDFLARE_ACCOUNT_ID as a secret instead of a repository variable                           | MEDIUM   | TEMPLATE--deploy-appwarden.yml                                                                              | —            |
| 3   | Using the wrong packageManager in the deploy step                                                    | MEDIUM   | TEMPLATE--deploy-appwarden.yml                                                                              | —            |
| 4   | Deploying from the wrong workingDirectory                                                            | CRITICAL | TEMPLATE--deploy-appwarden.yml                                                                              | —            |
| 5   | Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID                                                | CRITICAL | TEMPLATE--deploy-appwarden.yml, cloudflare-middleware-integration.mdx                                       | —            |
| 6   | Passing APPWARDEN_API_TOKEN to the build step but not uploading it to the Worker via wrangler-action | HIGH     | TEMPLATE--deploy-appwarden.yml                                                                              | —            |
| 7   | Expecting CSP changes to apply without redeploying the workflow                                      | MEDIUM   | TEMPLATE--deploy-appwarden.yml, cloudflare-middleware-integration.mdx, managing-content-security-policy.mdx | —            |

### Wire Appwarden into Vercel Edge Middleware (10 failure modes)

| #   | Mistake                                                                                                  | Priority | Source                                                             | Cross-skill?                      |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ | --------------------------------- |
| 1   | Using Edge Config without providing vercelApiToken                                                       | CRITICAL | src/schemas/vercel.ts, README, vercel-middleware-integration.mdx   | —                                 |
| 2   | Using an unrecognized cacheUrl format or wrong env var name                                              | HIGH     | src/schemas/vercel.ts, vercel-middleware-integration.mdx           | —                                 |
| 3   | Using Upstash KV but not assigning KV_URL correctly                                                      | MEDIUM   | vercel-middleware-integration.mdx                                  | —                                 |
| 4   | Using Edge Config without a Vercel API token that can manage Edge Config                                 | HIGH     | vercel-middleware-integration.mdx                                  | —                                 |
| 5   | Configuring Appwarden to read quarantine status through api.vercel.com instead of edge-config.vercel.com | HIGH     | https://vercel.com/docs/edge-config/using-edge-config              | —                                 |
| 6   | Losing the Edge Config read access token and not creating a new one                                      | MEDIUM   | https://vercel.com/docs/edge-config/using-edge-config              | —                                 |
| 7   | Including {{nonce}} in CSP directives for Vercel                                                         | HIGH     | src/schemas/vercel.ts, README, vercel-middleware-integration.mdx   | configure-nonce-csp-on-cloudflare |
| 8   | Matching static assets and API routes in the middleware matcher                                          | MEDIUM   | vercel-middleware-integration.mdx                                  | —                                 |
| 9   | Relying on the module-level memory cache for multi-tenant Vercel deployments                             | MEDIUM   | examples/bug-reports-vercel.md, src/runners/appwarden-on-vercel.ts | —                                 |
| 10  | Enabling Vercel Deployment Protection without a bypass secret for automated verification                 | MEDIUM   | https://upstash.com/docs/workflow/troubleshooting/vercel           | —                                 |

### Manage Appwarden API token in dashboard (4 failure modes)

| #   | Mistake                                                     | Priority | Source                                  | Cross-skill? |
| --- | ----------------------------------------------------------- | -------- | --------------------------------------- | ------------ |
| 1   | Creating the API token from the wrong URL or Discord        | HIGH     | intent-log.md, api-token-management.mdx | —            |
| 2   | Storing the API token in plaintext in repo or Wrangler vars | CRITICAL | README, api-token-management.mdx        | —            |
| 3   | Not copying the token before closing the creation modal     | HIGH     | api-token-management.mdx                | —            |
| 4   | Trying to create a second token while one is already active | MEDIUM   | api-token-management.mdx                | —            |

### Configure nonce-based CSP on Cloudflare (6 failure modes)

| #   | Mistake                                                                       | Priority | Source                                                                      | Cross-skill?                                                                        |
| --- | ----------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Using {{nonce}} on a platform that does not support HTML rewriting            | CRITICAL | README, src/schemas/vercel.ts                                               | wire-appwarden-into-vercel-edge-middleware, wire-appwarden-into-cloudflare-adapters |
| 2   | Trying to configure nonce-based CSP on Vercel                                 | CRITICAL | managing-content-security-policy.mdx, README                                | wire-appwarden-into-vercel-edge-middleware                                          |
| 3   | Starting CSP in enforced mode before validating directives                    | MEDIUM   | README, managing-content-security-policy.mdx                                | —                                                                                   |
| 4   | Passing CSP_DIRECTIVES as a malformed JSON string                             | MEDIUM   | src/schemas/use-content-security-policy.ts                                  | —                                                                                   |
| 5   | Editing CSP only in middleware code without updating the domain configuration | MEDIUM   | managing-content-security-policy.mdx, cloudflare-middleware-integration.mdx | —                                                                                   |
| 6   | Not redeploying the universal middleware after merging CSP changes            | MEDIUM   | managing-content-security-policy.mdx, cloudflare-middleware-integration.mdx | —                                                                                   |

### Create and configure Appwarden lock page (3 failure modes)

| #   | Mistake                                                        | Priority | Source                 | Cross-skill? |
| --- | -------------------------------------------------------------- | -------- | ---------------------- | ------------ |
| 1   | Configuring a lockPageSlug that does not exist as a route      | HIGH     | README                 | —            |
| 2   | Using incident-specific or alarming messaging on the lock page | MEDIUM   | intent-log.md          | —            |
| 3   | Providing an absolute URL or protocol-relative lockPageSlug    | MEDIUM   | src/schemas/helpers.ts | —            |

### Quarantine, unlock, and test a domain (5 failure modes)

| #   | Mistake                                                                        | Priority | Source                                                                   | Cross-skill? |
| --- | ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ | ------------ |
| 1   | Testing quarantine only in the browser without checking the heartbeat endpoint | MEDIUM   | src/constants.ts                                                         | —            |
| 2   | Forgetting to unlock after a staging test                                      | HIGH     | README                                                                   | —            |
| 3   | Running quarantine commands without the required dashboard permissions         | HIGH     | roles-and-permissions.mdx                                                | —            |
| 4   | Using /quarantine test but not checking /\_appwarden/test                      | MEDIUM   | vercel-middleware-integration.mdx, cloudflare-middleware-integration.mdx | —            |
| 5   | Not knowing the dashboard URL for lock/unlock when Discord is unavailable      | MEDIUM   | user-provided dashboard path                                             | —            |

### Verify setup before production and debug issues (5 failure modes)

| #   | Mistake                                                           | Priority | Source                                                                   | Cross-skill? |
| --- | ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ | ------------ |
| 1   | Switching debug to false before confirming the heartbeat is clean | MEDIUM   | README                                                                   | —            |
| 2   | Not inspecting build and deploy logs for appwarden-link errors    | MEDIUM   | README, cloudflare-middleware-integration.mdx                            | —            |
| 3   | Not checking the correct platform logs for middleware errors      | MEDIUM   | cloudflare-middleware-integration.mdx, vercel-middleware-integration.mdx | —            |
| 4   | Assuming non-HTML requests are quarantined like HTML requests     | MEDIUM   | src/runners/appwarden-on-vercel.ts, src/adapters/nextjs-cloudflare.ts    | —            |
| 5   | Assuming the domain is verified without checking the dashboard    | MEDIUM   | verify-setup.mdx                                                         | —            |

## Tensions

| Tension                                         | Skills                                                                           | Agent implication                                                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fast setup vs production safety                 | get-started-with-appwarden-middleware ↔ verify-setup-before-production-and-debug | Agents may stop at minimal examples and skip hardening steps                                                                                           |
| Debug visibility vs log noise                   | get-started-with-appwarden-middleware ↔ verify-setup-before-production-and-debug | Agents may leave debug: true in production or disable it before validating the heartbeat                                                               |
| Adapter convenience vs platform capability gaps | wire-appwarden-into-cloudflare-adapters ↔ configure-nonce-csp-on-cloudflare      | Agents may copy nonce-based CSP config across Cloudflare adapters, silently breaking CSP on Next.js/OpenNext                                           |
| Onboarding and installation ordering            | onboard-your-appwarden-organization ↔ get-started-with-appwarden-middleware      | Middleware can be installed before or during onboarding, but onboarding must be completed to finish installation because a valid API token is required |

## Cross-References

| From                                       | To                                       | Reason                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| onboard-your-appwarden-organization        | get-started-with-appwarden-middleware    | Onboarding must be completed before middleware installation can be finished, because a valid API token is only available after onboarding           |
| get-started-with-appwarden-middleware      | onboard-your-appwarden-organization      | Middleware can be installed before or during onboarding, but the agent must complete onboarding to obtain the API token and finish the installation |
| get-started-with-appwarden-middleware      | configure-nonce-csp-on-cloudflare        | Quickstart flows should point to CSP hardening                                                                                                      |
| get-started-with-appwarden-middleware      | create-and-configure-lock-page           | Quickstart flows should ensure a correct lock page                                                                                                  |
| get-started-with-appwarden-middleware      | verify-setup-before-production-and-debug | Initial setup should be followed by heartbeat verification and debug cleanup                                                                        |
| wire-appwarden-into-cloudflare-adapters    | configure-nonce-csp-on-cloudflare        | CSP behavior differs between Cloudflare adapters; the correct adapter must be matched to the CSP mode                                               |
| wire-appwarden-into-vercel-edge-middleware | configure-nonce-csp-on-cloudflare        | Vercel cannot use nonce-based CSP, so agents need the correct headers-only guidance                                                                 |
| wire-appwarden-into-vercel-edge-middleware | wire-appwarden-into-cloudflare-adapters  | Sharing integration patterns across Cloudflare and Vercel helps avoid duplicated mistakes                                                           |
| quarantine-unlock-and-test-domain          | verify-setup-before-production-and-debug | End-to-end quarantine tests should be preceded by the pre-launch verification checklist                                                             |
| quarantine-unlock-and-test-domain          | onboard-your-appwarden-organization      | Discord command permissions configured during onboarding determine who can run quarantine commands                                                  |
| verify-setup-before-production-and-debug   | manage-appwarden-api-token               | Production verification must include confirming the API token is stored as a secret, not a plain var                                                |

## Subsystems & Reference Candidates

| Skill                                            | Subsystems                                                                     | Reference candidates                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| onboard-your-appwarden-organization              | Discord bot, Appwarden GitHub App, domain configuration template               | Onboarding checklist and permission matrix                     |
| wire-appwarden-into-cloudflare-adapters          | Astro, React Router, TanStack Start, Next.js/OpenNext adapters; appwarden-link | Adapter-specific middleware patterns and CSP capability matrix |
| standalone-cloudflare-middleware-github-workflow | Standalone Cloudflare worker, deploy-appwarden-middleware.yml                  | Wrangler secret/environment alignment, workflow triggers       |
| wire-appwarden-into-vercel-edge-middleware       | Vercel edge-config, Upstash Redis cache providers; matcher/runtime             | Cache provider selection & configuration                       |
| configure-nonce-csp-on-cloudflare                | Domain configuration file                                                      | CSP directive and nonce patterns, platform capability matrix   |

## Remaining Gaps

| Skill                                            | Question                                                                                                                                  | Status   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| configure-nonce-csp-on-cloudflare                | Enumerate common CSP violation patterns and recommended fixes from production incidents beyond the generic report-only/enforced guidance. | open     |
| standalone-cloudflare-middleware-github-workflow | Capture the exact contents of the TEMPLATE--deploy-appwarden.yml workflow file and any environment-specific variations.                   | resolved |
| quarantine-unlock-and-test-domain                | Document the exact dashboard UI paths for quarantine lock/unlock/test when Discord is not available.                                      | resolved |
| wire-appwarden-into-vercel-edge-middleware       | Add real-world Upstash KV and Edge Config setup gotchas and error messages from Vercel dashboard logs.                                    | resolved |

## Recommended Skill File Structure

Flat layout under `skills/`:

- **Core skills:**
  - `appwarden-middleware-api-token/SKILL.md`
  - `appwarden-middleware-csp/SKILL.md`
  - `appwarden-middleware-lock-page/SKILL.md`
- **Framework skills:**
  - `appwarden-middleware-cloudflare-adapters/SKILL.md` (+ references for Astro, React Router, TanStack Start, Next.js Cloudflare)
  - `appwarden-middleware-cloudflare-workflow/SKILL.md`
  - `appwarden-middleware-vercel-edge/SKILL.md` (+ references for Edge Config and Upstash KV)
- **Lifecycle skills:**
  - `appwarden-middleware-onboard-organization/SKILL.md`
  - `appwarden-middleware-get-started/SKILL.md`
  - `appwarden-middleware-quarantine/SKILL.md`
  - `appwarden-middleware-verify-setup/SKILL.md`
- **Composition skills:** None yet; may be added later for specific ecosystem pairings.
- **Reference files:**
  - `appwarden-middleware-cloudflare-adapters/references/astro.md`
  - `appwarden-middleware-cloudflare-adapters/references/react-router.md`
  - `appwarden-middleware-cloudflare-adapters/references/tanstack-start.md`
  - `appwarden-middleware-cloudflare-adapters/references/nextjs-cloudflare.md`
  - `appwarden-middleware-vercel-edge/references/vercel-edge-config.md`
  - `appwarden-middleware-vercel-edge/references/upstash-kv.md`

## Composition Opportunities

| Library                | Integration points                           | Composition skill needed?                            |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Cloudflare adapters    | Astro, Next.js, React Router, TanStack Start | no — covered by framework skills above               |
| Vercel Edge Middleware | Cache providers (edge-config, Upstash Redis) | maybe — could become a separate cache-provider skill |
| Appwarden core config  | Organization/domain configuration repos      | no — managed by `appwarden` CLI and config repos     |

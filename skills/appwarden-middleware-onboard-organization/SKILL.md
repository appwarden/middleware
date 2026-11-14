---
name: appwarden-middleware-onboard-organization
description: >
  Onboard an organization to Appwarden: clear the terms and trial gates, sign in via Discord, connect the Appwarden bot, configure Discord command permissions, create a domain configuration repository from the template, install the Appwarden GitHub App with least privilege, and select the repository in the dashboard. Load this skill when a user is setting up Appwarden for the first time; middleware can be installed before or during onboarding, but onboarding must be completed to finish installation because the API token is created in the dashboard.
metadata:
  type: lifecycle
  library: "@appwarden/middleware"
  library_version: "3.17.15"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/getting-started/organization-onboarding.mdx"
---

# Appwarden Middleware — Onboard Your Organization

Connect your Discord server, GitHub organization, and a domain configuration repository to Appwarden. You can install `@appwarden/middleware` before or during this onboarding flow, but you must complete onboarding before you can create a valid API token in the dashboard and finish the installation.

## Gates before the dashboard opens

A new organization meets two gates on the first sign-in, before any of the setup steps below. Both appear automatically and neither can be skipped.

### Accept the Terms of Service

Appwarden asks you to confirm that you have read and agree to the Terms of Service and Privacy Policy, and records the acceptance together with the version accepted. The screen reappears only when those documents change. Tick the agreement checkbox on the **Accept Terms of Service** page and click **Continue**; Appwarden returns you to whatever you were opening.

### Start the trial

Appwarden is a paid subscription with a 14-day free trial, and the rest of the dashboard stays closed until an owner or admin starts it. Everyone else sees **Waiting for an admin**, and the plan picker is unavailable to them. Viewing billing needs **View Billing**; starting the trial, opening the billing portal, and changing anything about the subscription need **Administer Billing**.

A subscription in good standing — including one inside its trial — is also what makes the API usable. Without it, every `/v1/appwarden/*` route the middleware calls answers `402` with `error.code: "SUBSCRIPTION_REQUIRED"`, so the middleware on your site stops enforcing lock and unlock until billing is restored.

## Setup

1. Sign in to the Appwarden dashboard at `https://use.appwarden.io/?to=/`.
2. When prompted, authorize with Discord and select the server you want to manage.
3. Add the Appwarden Discord bot to that server.

## Core Patterns

### Add the Appwarden bot and link the server

In your Discord server, run the dashboard setup code:

```text
/settings setup code:ABC123DEF
```

The setup code is displayed in the Appwarden dashboard during onboarding. This command links the server to your Appwarden organization.

### Configure Discord command permissions for non-administrators

By default only Server Administrators can use Appwarden commands. To let a security team run `/quarantine` commands:

1. In Discord, open Server Settings > Integrations > Appwarden.
2. For each Appwarden command, add the `@security` role (or equivalent) under "Roles and Members".

```text
/quarantine lock domain:example.com
/quarantine unlock domain:example.com
/quarantine test domain:example.com
```

### Create the domain configuration repository from the template

Create the repository using the Appwarden template URL. The template ships with the required Appwarden folder structure, CLI helpers, and a deploy workflow.

```text
https://github.com/new?template_name=domain-configuration-template-repository&template_owner=appwarden&name=appwarden-domain-configuration&description=Repository%20for%20managing%20Appwarden%20domain%20configurations&visibility=private
```

Make the repository private and grant access only to the team that manages domain configuration.

### Install the Appwarden GitHub App with least privilege

1. Go to the GitHub App installation URL provided in the dashboard.
2. Choose **Only select repositories** and select **only** the domain configuration repository you just created.
3. Do not grant access to all repositories.

### Select the repository in the Appwarden dashboard

Return to `https://use.appwarden.io/?to=/`. In the organization onboarding flow, select the domain configuration repository from the list. The dashboard is not fully functional until this step is completed.

## Common Mistakes

### HIGH Waiting on a closed dashboard because no owner or admin started the subscription

Wrong:

```text
// The whole dashboard is read-only and the plan picker is disabled; treat it as a bug
```

Correct:

```text
// Ask an owner or admin to open Settings > Billing and click Start 14-day Trial
// Non-admins see "Waiting for an admin" until checkout completes
```

The dashboard is gated on a live subscription, not on onboarding progress. Starting the trial needs **Administer Billing**, so a security engineer without that permission cannot clear the gate — and cannot create a working API token either, because the middleware's `/v1/appwarden/*` calls answer `402 SUBSCRIPTION_REQUIRED`.

### HIGH Installing the GitHub App directly from GitHub instead of through the Appwarden dashboard

Wrong:

```text
// Browse to the Appwarden GitHub App in the GitHub Marketplace and install it directly
```

Correct:

```text
// Use the GitHub App installation URL provided in the Appwarden dashboard onboarding flow
```

The dashboard link is the only way to associate the GitHub App installation with your Appwarden organization. Installing directly from GitHub creates an orphaned installation that the dashboard cannot use to sync domain configuration.

### HIGH Installing the GitHub App with access to all repositories

Wrong:

```text
GitHub App installation > "All repositories"
```

Correct:

```text
GitHub App installation > "Only select repositories" > select my-org/appwarden-domains
```

Appwarden only needs to read and write the domain configuration repository. Granting access to all repositories violates least privilege and increases blast radius if the integration is compromised.

### HIGH Not configuring Discord command permissions for security staff

Wrong:

```text
// Only Server Administrators can run /quarantine
```

Correct:

```text
Discord Server Settings > Integrations > Appwarden > /quarantine lock > add @security role
```

If the incident-response team does not have Administrator privileges, they cannot lock or unlock domains until the command permissions are explicitly granted.

### MEDIUM Creating the domain configuration repository without using the template

Wrong:

```text
// Create a blank repository and manually add .appwarden/ folders
```

Correct:

```text
// Use the Appwarden template URL to create the repository
```

The template provides the required folder structure, middleware workflow templates, and CLI helpers. Starting from scratch requires re-creating these files manually and is error-prone.

### MEDIUM Skipping the repository selection step in the Appwarden dashboard

Wrong:

```text
// Install the GitHub App and assume onboarding is complete
```

Correct:

```text
// Return to https://use.appwarden.io/?to=/ and select the repository from the list
```

The Appwarden dashboard does not know which repository to sync until it is explicitly selected. Skipping this step leaves the organization in a partially onboarded state.

## Next Steps

Onboarding can be completed before, during, or after installing `@appwarden/middleware`. To finish the installation, create an API token in the dashboard at `https://use.appwarden.io/?to=/settings/security` once onboarding is complete and the subscription is live.

See also: `appwarden-middleware-get-started` — install and configure middleware.
See also: `appwarden-middleware-api-token` — create and manage API tokens.

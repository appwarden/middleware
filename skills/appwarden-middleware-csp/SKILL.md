---
name: csp
description: >
  Configure nonce-based Content Security Policy for Appwarden on Cloudflare. Edit the domain configuration file, start in report-only mode, inject nonces into HTML, redeploy the universal middleware, and switch to enforced after validation. This skill is Cloudflare-only; Vercel does not support nonce-based CSP rewriting.
metadata:
  type: core
  library: "@appwarden/middleware"
  library_version: "3.16.3"
sources:
  - "appwarden/appwarden-core-b:websites/appwarden-io/docs/src/content/docs/docs/guides/managing-content-security-policy.mdx"
  - "appwarden/middleware:src/schemas/use-content-security-policy.ts"
  - "appwarden/middleware:src/schemas/cloudflare.ts"
---

# Appwarden Middleware — Configure Nonce-Based CSP on Cloudflare

Nonce-based CSP is supported on Cloudflare Workers and Cloudflare framework adapters that rewrite HTML. It is not supported on Vercel or on the Next.js Cloudflare (OpenNext) adapter because those platforms cannot inject nonces into HTML.

## Setup

1. Locate your domain configuration file in the domain configuration repository, typically `.appwarden/domains/your-app.yml`.
2. Add a `csp-mode` and `csp-directives` block.
3. Open a pull request, merge it, and redeploy:
   - For the universal Cloudflare middleware: redeploy via `deploy-appwarden.yml`.
   - For Cloudflare framework adapters: redeploy the website itself so the updated middleware runs in the new build.

## Core Patterns

### Domain configuration file

```yaml
# .appwarden/domains/your-app.yml
domain: your-app.example.com
csp-mode: report-only
csp-directives:
  default-src:
    - "'self'"
  script-src:
    - "'self'"
    - "{{nonce}}"
  style-src:
    - "'self'"
    - "{{nonce}}"
  object-src:
    - "'none'"
```

Valid `csp-mode` values are `report-only`, `disabled`, or `enforced`.

### Roll out from report-only to enforced

Start with `csp-mode: report-only` to collect violations without blocking anything. After the browser console shows no violations, change to `csp-mode: enforced` and redeploy.

### Inject nonces into HTML

The Cloudflare middleware rewrites the HTML response and replaces `{{nonce}}` with a per-request nonce. Add `nonce` attributes to `<script>` and `<style>` tags:

```html
<script nonce="{{nonce}}" src="/app.js"></script>
<link rel="stylesheet" nonce="{{nonce}}" href="/styles.css" />
```

### Verify with browser DevTools

After deploying:

1. Open DevTools > Network.
2. Select a document request.
3. Check the response headers for `Content-Security-Policy` (or `Content-Security-Policy-Report-Only` in report-only mode).
4. View the page source and confirm `nonce` attributes are present.

## Common Mistakes

### CRITICAL Using {{nonce}} on a platform that does not support HTML rewriting

Wrong:

```yaml
# Vercel Edge Middleware config
csp-mode: enforced
csp-directives:
  script-src:
    - "'self'"
    - "{{nonce}}"
```

Correct:

```yaml
# Use headers-only CSP on Vercel; use {{nonce}} only on Cloudflare Workers / adapters
csp-mode: enforced
csp-directives:
  default-src:
    - "'self'"
```

Nonce placeholders are only rewritten on Cloudflare platforms that rewrite HTML. Vercel and the Next.js Cloudflare (OpenNext) adapter leave the placeholder in the header.

### CRITICAL Trying to configure nonce-based CSP on Vercel

Wrong:

```typescript
// middleware.ts on Vercel
contentSecurityPolicy: {
  mode: 'enforced',
  directives: { 'script-src': ["'self'", '{{nonce}}"] },
}
```

Correct:

```typescript
// Vercel: headers-only CSP, or move to Cloudflare for nonce support
contentSecurityPolicy: {
  mode: 'enforced',
  directives: { 'default-src': ["'self'"] },
}
```

Vercel Edge Middleware cannot rewrite HTML to inject nonces.

### MEDIUM Starting CSP in enforced mode before validating directives

Wrong:

```yaml
csp-mode: enforced
```

Correct:

```yaml
csp-mode: report-only
```

Start in report-only mode to collect violations. Switch to enforced only after no violations are reported.

### MEDIUM Passing CSP_DIRECTIVES as a malformed JSON string

Wrong:

```bash
CSP_DIRECTIVES="{ 'script-src': ['self'] }"
```

Correct:

```bash
CSP_DIRECTIVES='{"script-src": ["'\''self'\''"]}'
```

The schema parses string directives with `JSON.parse`. Malformed JSON causes a validation error surfaced in the heartbeat response.

### MEDIUM Editing CSP only in middleware code without updating the domain configuration

Wrong:

```typescript
// Only editing CSP in the worker code, ignoring .appwarden/domains/your-app.yml
```

Correct:

```yaml
# Update .appwarden/domains/your-app.yml, merge, and redeploy via deploy-appwarden.yml
```

For the universal Cloudflare middleware, CSP is sourced from the domain configuration file. Code-level overrides only apply to framework adapters.

### MEDIUM Not redeploying the universal middleware after merging CSP changes

Wrong:

```text
// Merge the PR and expect CSP to apply immediately
```

Correct:

```text
// Merge the PR, then trigger deploy-appwarden.yml
```

Changes to the domain configuration file only take effect after the deploy workflow runs and deploys the updated Worker. For framework adapters, the website itself must also be redeployed because the middleware is bundled into the application build.

## Next Steps

- For framework-specific CSP behavior, see `appwarden-middleware-cloudflare-adapters`.
- For Vercel headers-only CSP, see `appwarden-middleware-vercel-edge`.

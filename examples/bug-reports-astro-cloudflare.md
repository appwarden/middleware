# Bug report: astro-cloudflare adapter

## Scope reviewed

- `README.md`
- `src/adapters/astro-cloudflare.ts`
- `src/adapters/astro-cloudflare.test.ts`
- `src/middlewares/use-content-security-policy.ts`

## Findings

### 1. Post-processing failures can call `next()` a second time — RESOLVED

**Severity:** High

**Evidence**

- `src/adapters/astro-cloudflare.ts` executes `const response = await next()`.
- It then conditionally runs `await useContentSecurityPolicy(config.contentSecurityPolicy)(...)` against that response.
- The surrounding `catch` block logs the error and returns `next()` again.

**Impact**

- If CSP rewriting or any later post-processing throws after Astro has already produced a response, the adapter can re-enter downstream middleware/routes and trigger duplicate side effects.

### 2. Requests already on the lock page skip configured CSP entirely — RESOLVED

**Severity:** Medium

**Evidence**

- `src/adapters/astro-cloudflare.ts` returns `next()` immediately when `isOnLockPage(config.lockPageSlug, request.url)` is true.
- The CSP branch only runs later, after `await next()` has completed for the non-lock-page path.

**Impact**

- The maintenance page can be rendered without the configured CSP even though other HTML responses are post-processed.

### 3. The source example imports a package path that does not match the published entrypoint — RESOLVED

**Severity:** Low

**Evidence**

- The JSDoc example in `src/adapters/astro-cloudflare.ts` imports `@appwarden/middleware/astro`.
- `README.md` and the published entrypoints point users to `@appwarden/middleware/cloudflare/astro`.

**Impact**

- Consumers copying the source example are likely to import a nonexistent or stale package path.

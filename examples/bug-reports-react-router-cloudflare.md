# Bug report: react-router-cloudflare adapter

## Scope reviewed

- `README.md`
- `src/adapters/react-router-cloudflare.ts`
- `src/adapters/react-router-cloudflare.test.ts`
- `src/middlewares/use-content-security-policy.ts`

## Findings

### 1. Post-processing failures can call `next()` a second time — RESOLVED

**Severity:** High

**Evidence**

- `src/adapters/react-router-cloudflare.ts` executes `const response = await next()` for the unlocked path.
- It then conditionally runs `await useContentSecurityPolicy(config.contentSecurityPolicy)(...)` against that response.
- The outer `catch` logs the error and returns `next()` again for non-`Response` failures.

**Impact**

- If CSP rewriting throws after the route/loader has already run, React Router middleware can re-enter downstream work and duplicate side effects.

### 2. Requests already on the lock page skip configured CSP entirely — RESOLVED

**Severity:** Medium

**Evidence**

- `src/adapters/react-router-cloudflare.ts` returns `next()` immediately when `isOnLockPage(config.lockPageSlug, request.url)` is true.
- The CSP branch only exists later on the non-lock-page path, after `await next()`.

**Impact**

- The maintenance page can be delivered without the configured CSP even though normal HTML responses are post-processed.

### 3. The source example imports a package path that does not match the published entrypoint — RESOLVED

**Severity:** Low

**Evidence**

- The JSDoc example in `src/adapters/react-router-cloudflare.ts` imports `@appwarden/middleware/react-router`.
- `README.md` and the package entrypoints use `@appwarden/middleware/cloudflare/react-router`.

**Impact**

- Users copying the example are likely to hit the wrong import path first.

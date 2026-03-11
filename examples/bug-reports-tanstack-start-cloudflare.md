# Bug report: tanstack-start-cloudflare adapter

## Scope reviewed

- `README.md`
- `src/adapters/tanstack-start-cloudflare.ts`
- `src/adapters/tanstack-start-cloudflare.test.ts`
- `src/middlewares/use-content-security-policy.ts`

## Findings

### 1. A single catch block turns post-processing errors into a second `next()` call — RESOLVED

**Severity:** High

**Evidence**

- `src/adapters/tanstack-start-cloudflare.ts` executes `const result = await next()` on the unlocked path, then conditionally runs `useContentSecurityPolicy(...)` against `result.response`.
- The same `try` block also applies CSP to the lock-page redirect response when the site is locked.
- The outer `catch` logs the error and returns `next()` for non-`Response` failures.

**Impact**

- If CSP rewriting throws after TanStack Start has already produced a response, the adapter can invoke downstream work a second time.
- If CSP processing of the redirect response throws, the adapter falls through to `next()` and can fail open instead of serving the quarantine redirect.

### 2. Requests already on the lock page skip configured CSP entirely — RESOLVED

**Severity:** Medium

**Evidence**

- `src/adapters/tanstack-start-cloudflare.ts` returns `next()` immediately when `isOnLockPage(config.lockPageSlug, request.url)` is true.
- The CSP logic only runs later in the locked-redirect and post-origin branches.

**Impact**

- The maintenance page itself can be rendered without the configured CSP, which makes CSP coverage inconsistent.

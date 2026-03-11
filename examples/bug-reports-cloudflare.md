# Bug report: cloudflare bundle

## Scope reviewed

- `README.md`
- `src/bundles/cloudflare.ts`
- `src/runners/appwarden-on-cloudflare.ts`
- `src/schemas/cloudflare.ts`
- `src/schemas/use-appwarden.ts`
- `src/types/cloudflare.ts`
- `src/test/cloudflare-app.ts`

## Findings

### 1. Public TypeScript API advertises the wrong input shape — RESOLVED ✅

**Severity:** High

**Evidence**

- `src/bundles/cloudflare.ts` exports `createAppwardenMiddleware = appwardenOnCloudflare`.
- `src/runners/appwarden-on-cloudflare.ts` types the parameter as `CloudflareConfigType`.
- `src/schemas/cloudflare.ts` defines `CloudflareConfigType` as `z.infer<typeof UseAppwardenInputSchema>`, i.e. the resolved config object type.
- The runner immediately validates the same value with `ConfigFnInputSchema.safeParse(inputFn)` and then calls it as `parsedInput.data({ env, ctx, cf: {} })`.
- `src/test/cloudflare-app.ts` already needs `// @ts-expect-error todo types aren't making it here` to pass a config function.

**Impact**

- TypeScript consumers of `@appwarden/middleware/cloudflare` cannot use the documented/runtime-supported config-function API without casts or `@ts-expect-error`.

### 2. The documented top-level `contentSecurityPolicy` option is never applied — RESOLVED ✅

**Severity:** High

**Evidence**

- `README.md` shows the universal Cloudflare example passing `contentSecurityPolicy` at the top level.
- `src/schemas/use-appwarden.ts` does **not** define a top-level `contentSecurityPolicy` field on `UseAppwardenInputSchema`; only per-host `multidomainConfig[*].contentSecurityPolicy` exists.
- `src/runners/appwarden-on-cloudflare.ts` only reads `input.multidomainConfig?.[requestUrl.hostname]?.contentSecurityPolicy` before pushing `useContentSecurityPolicy` into the pipeline.

**Impact**

- A single-domain consumer following the README can believe CSP is enabled while the runner silently skips it.

### 3. The config-function context promises `cf`, but the runner always passes `{}`

**Severity:** Medium

**Evidence**

- `src/types/cloudflare.ts` publishes `RequestContext` as `{ env, ctx, cf }`.
- `src/runners/appwarden-on-cloudflare.ts` invokes the config function with `{ env, ctx, cf: {} }` instead of real request metadata.

**Impact**

- Consumers cannot branch on actual Cloudflare request metadata (for example country, colo, or ASN), even though the public type says they can.

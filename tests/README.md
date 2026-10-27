# E2E Tests

This directory contains end-to-end tests for the Appwarden middleware.

## Prerequisites

1. **Playwright Installation**: Make sure Playwright browsers are installed:

   ```bash
   pnpm exec playwright install
   ```

2. **Environment Variables**: The tests require the following environment variable:
   - `APPWARDEN_API_TOKEN`: API token for accessing the Appwarden staging API

## Running Tests

To run the E2E tests:

```bash
pnpm test:e2e
```

## Test Configuration

The tests are configured in `playwright.config.ts` at the repository root. Key settings:

- **Test Directory**: `./tests`
- **Timeout**: 120 seconds per test (needed for quarantine propagation delays)
- **Browsers**: Chromium
- **Retries**: 2 retries on CI, 0 locally

## Test Details

The `middleware.e2e.test.ts` file tests:

- Quarantine lock/unlock functionality across multiple websites
- CSP (Content Security Policy) header injection
- `bypassPaths` and `api.basePaths` routing against the shared thin API
- Propagation delays and retry logic
- Both "initially locked" and "initially unlocked" modes

Tested websites include:

- appwarden.cc
- astro.appwarden.cc
- tanstack.appwarden.cc
- react-router.appwarden.cc
- next-lowest-supported.appwarden.cc
- appwarden.online
- edge-config.appwarden.online

## API and bypass coverage

Every test website exposes the same thin JSON API and is configured with the same
middleware options:

- `bypassPaths`: `/health` and `/api/health`
- `api.basePaths`: `/api`
- `api.response`: status `521`, body `{"error":"Service unavailable","source":"appwarden"}`,
  headers `content-type: application/json` and `x-appwarden-lock: api`

The API routes the tests depend on:

- `GET /api/hello` -> `{"message":"Hello World"}`
- `GET /api/hello/world` -> `{"message":"Hello World"}`
- `POST /api/echo` -> echo of the JSON request body
- `GET /api/health` -> `{"status":"ok"}`
- `GET /health` -> `{"status":"ok"}`
- `GET /api-docs` -> `{"message":"docs"}`

Assertions, issued through Playwright's `request` fixture in both lock states:

- **Locked**: `GET /api/hello` and `POST /api/echo` return the configured API lock
  response (status `521`, the configured body, `content-type: application/json` and
  `x-appwarden-lock: api`); `GET /api-docs` with `Accept: text/html` and
  `maxRedirects: 0` returns `302` to the lock page, proving `/api-docs` is not matched
  by `api.basePaths` at the segment boundary.
- **Unlocked**: all six routes return `200` with the JSON bodies above.
- **Both states**: `GET /health` and `GET /api/health` return `200 {"status":"ok"}`,
  proving the bypass paths always pass through, even while locked.

See `plans/ai-specs/test-website-api.md` in the test-website repo for the website-side
API wiring and middleware configuration this coverage depends on.

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
- **Browsers**: Chromium, Firefox, and WebKit
- **Retries**: 2 retries on CI, 0 locally

## Test Details

The `middleware.e2e.test.ts` file tests:

- Quarantine lock/unlock functionality across multiple websites
- CSP (Content Security Policy) header injection
- Propagation delays and retry logic
- Both "initially locked" and "initially unlocked" modes

Tested websites include:

- appwarden.cc
- astro.appwarden.cc
- tanstack.appwarden.cc
- react-router.appwarden.cc
- nextjs14.appwarden.cc
- appwarden.online

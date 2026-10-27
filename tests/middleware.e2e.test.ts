import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
  test,
} from "@playwright/test"

/**
 * Appwarden Middleware E2E Tests
 *
 * This test suite validates Appwarden middleware behavior across multiple test websites.
 * It tests the quarantine lock/unlock functionality, CSP header injection, and the
 * `bypassPaths` + `api.basePaths` routing feature.
 *
 * Test websites:
 * - appwarden.cc
 * - astro.appwarden.cc
 * - tanstack.appwarden.cc
 * - react-router.appwarden.cc
 * - next-lowest-supported.appwarden.cc
 * - appwarden.online (vercel)
 * - edge-config.appwarden.online (vercel)
 *
 * Each website is tested in both "initially locked" and "initially unlocked" modes
 * based on its current quarantine status.
 *
 * The Vercel websites are driven through the staging API with `service: "vercel"`,
 * which requires a `cacheUrl`. Set `EDGE_CONFIG` (or `KV_URL`) to run them;
 * otherwise those suites are skipped.
 */

// Run all middleware E2E tests in parallel across websites
test.describe.configure({ mode: "parallel" })

// API and bypass configuration every test website is deployed with (see
// plans/ai-specs/test-website-api.md).
const API_BASE_PATHS = ["/api"]
const BYPASS_PATHS = ["/health", "/api/health"]
const API_LOCK_RESPONSE = {
  status: 521,
  body: '{"error":"Service unavailable","source":"appwarden"}',
  headers: {
    "content-type": "application/json",
    "x-appwarden-lock": "api",
  },
}

// Vercel test websites need a cache URL: the staging API requires `cacheUrl`
// when `service` is "vercel". Reuse the same env vars the middleware itself
// uses, and skip those websites when neither is set.
const VERCEL_CACHE_URL = process.env.EDGE_CONFIG || process.env.KV_URL

// Test configuration
const TEST_WEBSITES = [
  {
    hostname: "appwarden.cc",
    url: "https://appwarden.cc",
    service: "cloudflare" as const,
    lockPageSlug: "/maintenance",
    // Matches csp-mode: report-only in
    // dev--appwarden-domain-configuration/.appwarden/domains/appwarden-cc.yml.
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
  {
    hostname: "astro.appwarden.cc",
    url: "https://astro.appwarden.cc",
    service: "cloudflare" as const,
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
  {
    hostname: "tanstack.appwarden.cc",
    url: "https://tanstack.appwarden.cc",
    service: "cloudflare" as const,
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
  {
    hostname: "react-router.appwarden.cc",
    url: "https://react-router.appwarden.cc",
    service: "cloudflare" as const,
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
  {
    hostname: "next-lowest-supported.appwarden.cc",
    url: "https://next-lowest-supported.appwarden.cc",
    service: "cloudflare" as const,
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["'self'"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
  {
    hostname: "appwarden.online",
    url: "https://appwarden.online",
    service: "vercel" as const,
    cacheUrl: VERCEL_CACHE_URL,
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["'self'"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
  {
    hostname: "edge-config.appwarden.online",
    url: "https://edge-config.appwarden.online",
    service: "vercel" as const,
    cacheUrl: VERCEL_CACHE_URL,
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["'self'"] },
    bypassPaths: BYPASS_PATHS,
    apiBasePaths: API_BASE_PATHS,
    apiLockResponse: API_LOCK_RESPONSE,
  },
]

const API_BASE_URL = "https://staging-api.appwarden.io"
const PROPAGATION_DELAY_MS = 30000
const RETRY_DELAY_MS = 5000

// Helper types
type QuarantineMode = "lock" | "unlock"
type TestWebsite = (typeof TEST_WEBSITES)[number]

interface QuarantineStatusResponse {
  content?: {
    // The staging API reports the lock state as `isLocked` (0 or 1).
    isLocked?: boolean | number
  }
  error?: {
    message: string
  }
}

/**
 * Fetch the current quarantine status for a website
 */
async function fetchQuarantineStatus(
  website: TestWebsite,
): Promise<{ locked: boolean }> {
  const apiToken = process.env.APPWARDEN_API_TOKEN
  if (!apiToken) {
    throw new Error("APPWARDEN_API_TOKEN environment variable is not set")
  }

  const response = await fetch(`${API_BASE_URL}/v1/appwarden/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fqdn: website.hostname,
      service: website.service,
      ...(website.service === "vercel" ? { cacheUrl: website.cacheUrl } : {}),
      appwardenApiToken: apiToken,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch quarantine status: ${response.status} ${response.statusText}`,
    )
  }

  const data: QuarantineStatusResponse = await response.json()

  if (data.error) {
    throw new Error(`API error: ${data.error.message}`)
  }

  return {
    locked: Boolean(data.content?.isLocked),
  }
}

/**
 * Set the quarantine mode for a website
 */
async function setQuarantineMode(
  website: TestWebsite,
  mode: QuarantineMode,
): Promise<void> {
  const apiToken = process.env.APPWARDEN_API_TOKEN
  if (!apiToken) {
    throw new Error("APPWARDEN_API_TOKEN environment variable is not set")
  }

  const response = await fetch(`${API_BASE_URL}/v1/appwarden/mode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fqdn: website.hostname,
      service: website.service,
      ...(website.service === "vercel" ? { cacheUrl: website.cacheUrl } : {}),
      mode,
      appwardenApiToken: apiToken,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()

    // Ignore "already locked/unlocked" responses (idempotent behavior).
    // The staging API returns 409 Conflict; 400 is kept for older deployments.
    if (
      (response.status === 400 || response.status === 409) &&
      errorText.includes("already")
    ) {
      return
    }

    throw new Error(
      `Failed to set quarantine mode: ${response.status} ${response.statusText} - ${errorText}`,
    )
  }
}

/**
 * Wait for a specified duration
 */
async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if the page is showing the lock/maintenance page
 */
function isLockPage(url: string, lockPageSlug: string): boolean {
  return new URL(url).pathname === lockPageSlug
}

/**
 * Verify CSP header matches expected configuration
 */
function verifyCspHeader(
  headers: Record<string, string>,
  expectedMode: "report-only" | "enforced" | "disabled",
  expectedDirectives: Record<string, string[]>,
): void {
  if (expectedMode === "disabled") {
    expect(headers["content-security-policy"]).toBeUndefined()
    expect(headers["content-security-policy-report-only"]).toBeUndefined()
    return
  }

  const headerName =
    expectedMode === "report-only"
      ? "content-security-policy-report-only"
      : "content-security-policy"

  const cspHeader = headers[headerName]
  if (!cspHeader) {
    const availableHeaders = Object.keys(headers).join(", ")
    throw new Error(
      `Expected CSP header "${headerName}" to be present, but it was not found. ` +
        `Available headers: ${availableHeaders || "<none>"}`,
    )
  }

  // Verify each expected directive is present
  for (const [directive, values] of Object.entries(expectedDirectives)) {
    // Handle nonce placeholder - verify the directive exists and includes a nonce value
    if (values.includes("{{nonce}}")) {
      // Example we want to allow: "script-src 'self' 'nonce-abc123' ..."
      // Use (?:^|;\s*) to anchor the directive to a token boundary, preventing
      // 'script-src' from matching 'script-src-elem' or other prefixed directives.
      const nonceRegex = new RegExp(
        `(?:^|;\\s*)${directive}\\s[^;]*'nonce-[^']+'`,
      )
      expect(cspHeader).toMatch(nonceRegex)
    } else {
      for (const value of values) {
        expect(cspHeader).toContain(`${directive} ${value}`)
      }
    }
  }
}

/**
 * Assert an API response matches the configured API lock response.
 */
async function expectApiLockResponse(
  response: APIResponse,
  website: TestWebsite,
): Promise<void> {
  const { status, body, headers } = website.apiLockResponse
  const responseHeaders = response.headers()

  expect(response.status()).toBe(status)
  expect(await response.text()).toBe(body)
  expect(responseHeaders["content-type"]).toContain(headers["content-type"])
  expect(responseHeaders["x-appwarden-lock"]).toBe(headers["x-appwarden-lock"])
}

/**
 * Expect every `api.basePaths` request to return the configured API lock
 * response while the website is locked, for both GET and POST.
 */
async function expectApiLocked(
  request: APIRequestContext,
  website: TestWebsite,
): Promise<void> {
  console.log("   🚧 Verifying API routes are locked...")

  const helloResponse = await request.get(`${website.url}/api/hello`, {
    headers: { accept: "application/json" },
  })
  await expectApiLockResponse(helloResponse, website)
  console.log("      ✅ GET /api/hello returns the API lock response")

  const echoResponse = await request.post(`${website.url}/api/echo`, {
    data: { ping: "pong" },
  })
  await expectApiLockResponse(echoResponse, website)
  console.log("      ✅ POST /api/echo returns the API lock response")
}

/**
 * Expect the thin API to reach the origin while the website is unlocked.
 */
async function expectApiUnlocked(
  request: APIRequestContext,
  website: TestWebsite,
): Promise<void> {
  console.log("   🚦 Verifying API routes are unlocked...")

  const helloResponse = await request.get(`${website.url}/api/hello`, {
    headers: { accept: "application/json" },
  })
  expect(helloResponse.status()).toBe(200)
  expect(await helloResponse.json()).toEqual({ message: "Hello World" })
  console.log("      ✅ GET /api/hello returns Hello World")

  const helloWorldResponse = await request.get(
    `${website.url}/api/hello/world`,
    { headers: { accept: "application/json" } },
  )
  expect(helloWorldResponse.status()).toBe(200)
  expect(await helloWorldResponse.json()).toEqual({ message: "Hello World" })
  console.log("      ✅ GET /api/hello/world returns Hello World")

  const echoPayload = { ping: "pong" }
  const echoResponse = await request.post(`${website.url}/api/echo`, {
    data: echoPayload,
  })
  expect(echoResponse.status()).toBe(200)
  expect(await echoResponse.json()).toEqual(echoPayload)
  console.log("      ✅ POST /api/echo echoes the request body")

  const apiDocsResponse = await request.get(`${website.url}/api-docs`, {
    headers: { accept: "application/json" },
  })
  expect(apiDocsResponse.status()).toBe(200)
  expect(await apiDocsResponse.json()).toEqual({ message: "docs" })
  console.log("      ✅ GET /api-docs returns docs")
}

/**
 * Expect the configured bypass paths to reach the origin in any lock state,
 * proving bypassPaths takes precedence over api.basePaths.
 */
async function expectBypassOpen(
  request: APIRequestContext,
  website: TestWebsite,
): Promise<void> {
  console.log("   🛟 Verifying bypass paths stay open...")

  for (const bypassPath of website.bypassPaths) {
    const response = await request.get(`${website.url}${bypassPath}`, {
      headers: { accept: "application/json" },
    })
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
    console.log(`      ✅ GET ${bypassPath} bypasses the lock`)
  }
}

/**
 * Expect `/api-docs` to fall through to the website branch while locked: it is
 * redirected to the lock page instead of matching the `/api` api base path.
 */
async function expectApiDocsNotLockedAsApi(
  request: APIRequestContext,
  website: TestWebsite,
): Promise<void> {
  console.log("   🧭 Verifying /api-docs is not treated as an api path...")

  const response = await request.get(`${website.url}/api-docs`, {
    headers: { accept: "text/html" },
    maxRedirects: 0,
  })

  expect(response.status()).toBe(302)
  const location = response.headers()["location"]
  expect(location).toBeTruthy()
  expect(new URL(location).pathname).toBe(website.lockPageSlug)
  console.log("      ✅ /api-docs redirected to the lock page")
}

/**
 * Navigate to the website (soft reload - preserves browser cache)
 */
async function navigateToWebsite(
  page: Page,
  website: TestWebsite,
): Promise<void> {
  await page.goto(website.url, { waitUntil: "networkidle" })
}

/**
 * Expect the website to be in a locked/unlocked state, with an optional single retry
 * to account for propagation delays.
 */
async function expectLockStateWithOptionalRetry(
  page: Page,
  website: TestWebsite,
  expectedLocked: boolean,
  options?: { retryMessage?: string },
): Promise<void> {
  const retryMessage = options?.retryMessage
  const maxAttempts = retryMessage ? 5 : 1
  let attempt = 0
  let isLocked: boolean

  do {
    attempt++
    await navigateToWebsite(page, website)
    isLocked = isLockPage(page.url(), website.lockPageSlug)

    if (isLocked === expectedLocked) {
      break
    }

    if (retryMessage && attempt < maxAttempts) {
      console.log(retryMessage)
      await wait(RETRY_DELAY_MS)
    }
  } while (attempt < maxAttempts && isLocked !== expectedLocked)

  if (isLocked !== expectedLocked) {
    const url = page.url()
    const pathname = new URL(url).pathname
    const expectedSlug = website.lockPageSlug

    let actual: string
    if (isLocked) {
      actual = `lock page (${expectedSlug})`
    } else if (pathname === "/" || pathname === "") {
      actual = "homepage"
    } else if (expectedLocked) {
      actual = `wrong lock page (${pathname})`
    } else {
      actual = `unexpected page (${pathname})`
    }

    let expected: string
    if (expectedLocked) {
      expected = `lock page (${expectedSlug})`
    } else {
      expected = "homepage"
    }

    throw new Error(`Expected ${expected} but got ${actual} at URL: ${url}`)
  }
}

/**
 * Verify CSP configuration for a given website.
 */
async function verifyWebsiteCsp(
  page: Page,
  website: TestWebsite,
): Promise<void> {
  console.log("   🔒 Verifying CSP header...")
  // Use a cache-busting query param to avoid conditional requests returning 304
  // which often omit CSP headers even though the browser still enforces them.
  const url = new URL(website.url)
  url.searchParams.set("_cspCheck", Date.now().toString())

  const response = await page.goto(url.toString())
  const headers = response?.headers() ?? {}
  verifyCspHeader(headers, website.cspMode, website.cspDirectives)
  const headerName =
    website.cspMode === "report-only"
      ? "content-security-policy-report-only"
      : "content-security-policy"
  const cspHeader = headers[headerName]
  const expectsNonce = Object.values(website.cspDirectives).some((values) =>
    values.includes("{{nonce}}"),
  )
  const noncePresent = !!cspHeader && /'nonce-[^']+'/.test(cspHeader)

  console.log(`      🧩 CSP mode: ${website.cspMode} (header: ${headerName})`)
  console.log(
    `      🧩 CSP nonce expected: ${expectsNonce ? "yes" : "no"}, present: ${
      noncePresent ? "yes" : "no"
    }`,
  )
  console.log("      ✅ CSP header verified")
}

/**
 * Set quarantine mode and wait for propagation.
 */
async function setQuarantineModeWithPropagation(
  website: TestWebsite,
  mode: QuarantineMode,
): Promise<void> {
  await setQuarantineMode(website, mode)
  console.log(
    `      ⏳ Waiting ${PROPAGATION_DELAY_MS / 1000}s for propagation...`,
  )
  await wait(PROPAGATION_DELAY_MS)
}

// Test suite for each website
for (const website of TEST_WEBSITES) {
  test.describe(`Middleware tests for ${website.hostname}`, () => {
    let initialLockState: boolean
    let testStartTime: number
    let skipReason: string | undefined

    test.beforeAll(async () => {
      // The staging API cannot resolve a Vercel domain without a cache URL.
      if (website.service === "vercel" && !website.cacheUrl) {
        skipReason = `set EDGE_CONFIG or KV_URL to drive ${website.hostname} through the staging API`
        console.log(`\n⏭️  Skipping ${website.hostname}: ${skipReason}`)
        test.skip()
      }

      testStartTime = Date.now()
      console.log(
        `\n🔍 Fetching initial quarantine status for ${website.hostname}...`,
      )
      const status = await fetchQuarantineStatus(website)
      initialLockState = status.locked
      console.log(
        `   Initial state: ${initialLockState ? "LOCKED" : "UNLOCKED"}`,
      )
    })

    test.afterAll(async ({ browser }) => {
      if (skipReason) {
        return
      }

      // Restore original state
      console.log(
        `\n🔄 Restoring ${website.hostname} to initial state (${
          initialLockState ? "LOCKED" : "UNLOCKED"
        })...`,
      )
      await setQuarantineModeWithPropagation(
        website,
        initialLockState ? "lock" : "unlock",
      )

      // Visit the site to confirm it matches the original lock state
      console.log("   🔍 Verifying restored state via browser...")
      const context = await browser.newContext()
      const page = await context.newPage()
      await expectLockStateWithOptionalRetry(page, website, initialLockState, {
        retryMessage: `      ⚠️  Restored state not yet effective, waiting additional ${
          RETRY_DELAY_MS / 1000
        }s...`,
      })
      await context.close()
      console.log("   ✅ Restored to initial state (verified)")

      const testDuration = ((Date.now() - testStartTime) / 1000).toFixed(1)
      console.log(`   ⏱️  Test duration: ${testDuration}s\n`)
    })

    test("should handle lock/unlock transitions correctly", async ({
      page,
      request,
    }) => {
      if (initialLockState) {
        // Initially locked mode
        console.log(
          `\n📋 Testing INITIALLY LOCKED mode for ${website.hostname}`,
        )

        // First visit - should show lock page
        console.log("   1️⃣  First visit (expecting lock page)...")
        await expectLockStateWithOptionalRetry(page, website, true)
        console.log("      ✅ Lock page displayed")

        // Second visit - should still show lock page
        console.log("   2️⃣  Second visit (expecting lock page)...")
        await expectLockStateWithOptionalRetry(page, website, true)
        console.log("      ✅ Lock page still displayed")

        // Verify the api/bypass behavior while locked
        await expectApiLocked(request, website)
        await expectBypassOpen(request, website)
        await expectApiDocsNotLockedAsApi(request, website)

        // Unlock the website
        console.log("   🔓 Unlocking website...")
        await setQuarantineModeWithPropagation(website, "unlock")

        // Third visit - should show real homepage
        console.log("   3️⃣  Third visit (expecting real homepage)...")
        await expectLockStateWithOptionalRetry(page, website, false, {
          retryMessage: `      ⚠️  Still locked, waiting additional ${RETRY_DELAY_MS / 1000}s...`,
        })
        console.log("      ✅ Real homepage displayed")

        // Verify the api/bypass behaviour while unlocked
        await expectApiUnlocked(request, website)
        await expectBypassOpen(request, website)

        // Verify CSP header
        await verifyWebsiteCsp(page, website)
      } else {
        // Initially unlocked mode
        console.log(
          `\n📋 Testing INITIALLY UNLOCKED mode for ${website.hostname}`,
        )

        // First visit - should show real homepage
        console.log("   1️⃣  First visit (expecting real homepage)...")
        await expectLockStateWithOptionalRetry(page, website, false, {
          retryMessage: `      ⚠️  Still locked, waiting additional ${RETRY_DELAY_MS / 1000}s...`,
        })
        console.log("      ✅ Real homepage displayed")

        // Verify the api/bypass behaviour while unlocked
        await expectApiUnlocked(request, website)
        await expectBypassOpen(request, website)

        // Verify CSP header
        await verifyWebsiteCsp(page, website)

        // Lock the website
        console.log("   🔒 Locking website...")
        await setQuarantineModeWithPropagation(website, "lock")

        // Second visit - should show lock page
        console.log("   2️⃣  Second visit (expecting lock page)...")
        await expectLockStateWithOptionalRetry(page, website, true, {
          retryMessage: `      ⚠️  Still unlocked, waiting additional ${RETRY_DELAY_MS / 1000}s...`,
        })
        console.log("      ✅ Lock page displayed")

        // Third visit - should still show lock page
        console.log("   3️⃣  Third visit (expecting lock page)...")
        await expectLockStateWithOptionalRetry(page, website, true)
        console.log("      ✅ Lock page still displayed")

        // Verify the api/bypass behaviour while locked
        await expectApiLocked(request, website)
        await expectBypassOpen(request, website)
        await expectApiDocsNotLockedAsApi(request, website)
      }
    })
  })
}

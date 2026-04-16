import { expect, test, type Page } from "@playwright/test"

/**
 * Appwarden Middleware E2E Tests
 *
 * This test suite validates Appwarden middleware behavior across multiple test websites.
 * It tests the quarantine lock/unlock functionality and CSP header injection.
 *
 * Test websites:
 * - astro.appwarden.cc
 * - tanstack.appwarden.cc
 * - react-router.appwarden.cc
 * - nextjs14.appwarden.cc
 * - appwarden.online (vercel)
 *
 * Each website is tested in both "initially locked" and "initially unlocked" modes
 * based on its current quarantine status.
 */

// Run all middleware E2E tests in parallel across websites
test.describe.configure({ mode: "parallel" })

// Test configuration
const TEST_WEBSITES = [
  {
    hostname: "appwarden.cc",
    url: "https://appwarden.cc",
    lockPageSlug: "/maintenance",
    cspMode: "enforced" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
  },
  {
    hostname: "astro.appwarden.cc",
    url: "https://astro.appwarden.cc",
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
  },
  {
    hostname: "tanstack.appwarden.cc",
    url: "https://tanstack.appwarden.cc",
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
  },
  {
    hostname: "react-router.appwarden.cc",
    url: "https://react-router.appwarden.cc",
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["self", "{{nonce}}"] },
  },
  {
    hostname: "nextjs14.appwarden.cc",
    url: "https://nextjs14.appwarden.cc",
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["'self'"] },
  },
  {
    hostname: "appwarden.online",
    url: "https://appwarden.online",
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["'self'"] },
  },
  {
    hostname: "edge-config.appwarden.online",
    url: "https://edge-config.appwarden.online",
    lockPageSlug: "/maintenance",
    cspMode: "report-only" as const,
    cspDirectives: { "script-src": ["'self'"] },
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
    locked: boolean
  }
  error?: {
    message: string
  }
}

/**
 * Fetch the current quarantine status for a website
 */
async function fetchQuarantineStatus(
  hostname: string,
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
      fqdn: hostname,
      service: "cloudflare",
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
    locked: data.content?.locked ?? false,
  }
}

/**
 * Set the quarantine mode for a website
 */
async function setQuarantineMode(
  hostname: string,
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
      fqdn: hostname,
      mode,
      appwardenApiToken: apiToken,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()

    // Ignore "already locked/unlocked" errors (idempotent behavior)
    if (response.status === 400 && errorText.includes("already")) {
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
  return url.includes(lockPageSlug)
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

  expect(isLocked).toBe(expectedLocked)
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
  await setQuarantineMode(website.hostname, mode)
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

    test.beforeAll(async () => {
      testStartTime = Date.now()
      console.log(
        `\n🔍 Fetching initial quarantine status for ${website.hostname}...`,
      )
      const status = await fetchQuarantineStatus(website.hostname)
      initialLockState = status.locked
      console.log(
        `   Initial state: ${initialLockState ? "LOCKED" : "UNLOCKED"}`,
      )
    })

    test.afterAll(async ({ browser }) => {
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

        // Unlock the website
        console.log("   🔓 Unlocking website...")
        await setQuarantineModeWithPropagation(website, "unlock")

        // Third visit - should show real homepage
        console.log("   3️⃣  Third visit (expecting real homepage)...")
        await expectLockStateWithOptionalRetry(page, website, false, {
          retryMessage: `      ⚠️  Still locked, waiting additional ${RETRY_DELAY_MS / 1000}s...`,
        })
        console.log("      ✅ Real homepage displayed")

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
      }
    })
  })
}

import { defineConfig, devices } from "@playwright/test"
import "dotenv/config"

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Directory where tests are located
  testDir: "./tests",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: "html",

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // baseURL: 'http://127.0.0.1:3000',

    // Collect trace when retrying the failed test
    trace: "on-first-retry",
  },

  // Configure projects: run in multiple browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Timeout for each test
  timeout: 120_000, // 2 minutes per test (needed for quarantine propagation delays)

  // Timeout for expect() assertions
  expect: {
    timeout: 10_000, // 10 seconds
  },
})

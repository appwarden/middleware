import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import tsconfigPaths from "vite-tsconfig-paths"
import { defaultExclude, defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    // Preserve tsconfig path resolution for imports
    tsconfigPaths({ root: __dirname }),
    // Configure the Cloudflare Workers Vitest integration using wrangler config
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
    }),
  ],
  test: {
    globals: true,
    // Define build-time globals that are normally injected by tsup
    // These match the values in tsup.config.ts for non-production builds
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      ...defaultExclude,
      "./build/**",
      "src/test/vercel-integration.test.ts",
      // Exclude Playwright E2E tests (run via `pnpm test:e2e`, not Vitest)
      "tests/**/*.e2e.test.ts",
    ],
    coverage: {
      provider: "istanbul", // V8 is not supported in Cloudflare Workers environment
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      exclude: [
        ...defaultExclude,
        "build/**",
        "scripts/**",
        "src/test/**",
        "src/vitest.d.ts",
      ],
      thresholds: {
        lines: 40,
        functions: 65,
        branches: 60,
        statements: 40,
      },
    },
  },
})

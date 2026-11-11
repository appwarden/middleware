import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { createRequire } from "node:module"
import { dirname } from "node:path"
import tsconfigPaths from "vite-tsconfig-paths"
import { defaultExclude, defineConfig } from "vitest/config"

const require_ = createRequire(import.meta.url)

/**
 * `@vercel/functions` 3.11 loads `@vercel/oidc`, whose CommonJS build does `require("jose")`
 * at module scope. The Workers test conditions resolve `jose` to its workerd/browser ESM
 * build, which a `require` cannot consume — the binding comes back undefined and the import
 * throws before any test in the file runs. Resolve it to the CommonJS build instead, which
 * `nodejs_compat` loads. This is a test-environment detail only: the published bundle
 * resolves `jose` for Node, where the `require` condition already wins.
 *
 * Resolved through `@vercel/functions` rather than from here because pnpm does not hoist
 * `jose` to the workspace root.
 */
const joseCommonJs = require_.resolve("jose", {
  paths: [dirname(require_.resolve("@vercel/functions"))],
})

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
  resolve: {
    alias: [{ find: /^jose$/, replacement: joseCommonJs }],
  },
  test: {
    globals: true,
    // Define build-time globals that are normally injected by tsup
    // These match the values in tsup.config.ts for non-production builds
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      ...defaultExclude,
      "./build/**",
      "src/test/vercel-integration.test.ts",
      "scripts/generate-appwarden-config.test.ts",
      "scripts/appwarden-link.test.ts",
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

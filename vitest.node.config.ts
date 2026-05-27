import tsconfigPaths from "vite-tsconfig-paths"
import { defaultExclude, defineConfig } from "vitest/config"

/**
 * Node-based Vitest config for Vercel integration tests
 *
 * This config runs tests in a standard Node.js environment (not Workers runtime)
 * to allow proper mocking of Vercel-specific modules like @vercel/edge-config
 * and @vercel/functions.
 */
export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname })],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Run Vercel integration tests and postbuild script tests
    include: [
      "src/test/vercel-integration.test.ts",
      "scripts/appwarden-link.test.ts",
    ],
    exclude: [...defaultExclude, "./build/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      exclude: [
        ...defaultExclude,
        "build/**",
        "scripts/**",
        "src/test/**",
        "src/vitest.d.ts",
      ],
    },
  },
})

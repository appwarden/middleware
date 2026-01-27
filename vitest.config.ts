import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config"
import tsconfigPaths from "vite-tsconfig-paths"
import { defaultExclude } from "vitest/config"

export default defineWorkersProject(() => ({
  plugins: [tsconfigPaths({ root: __dirname })],
  test: {
    globals: true,
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: {
          configPath: "./wrangler.jsonc",
        },
      },
    },
    exclude: [...defaultExclude, "./build/**"],
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
}))

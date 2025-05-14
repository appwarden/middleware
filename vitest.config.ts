import inspector from "inspector"
import tsconfigPaths from "vite-tsconfig-paths"
import { defaultExclude, defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname })],
  test: {
    globals: true,
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    testTimeout: inspector.url() ? 2 ** 30 : 15000,
    setupFiles: [`${__dirname}/src/test/setup.ts`],
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
      thresholds: {
        lines: 40,
        functions: 65,
        branches: 60,
        statements: 40,
      },
    },
  },
})

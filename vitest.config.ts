import inspector from "inspector"
import tsconfigPaths from "vite-tsconfig-paths"
import { defaultExclude, defineProject } from "vitest/config"

export default defineProject({
  plugins: [tsconfigPaths({ root: __dirname })],
  test: {
    globals: true,
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    testTimeout: inspector.url() ? 2 ** 30 : 15000,
    setupFiles: [`${__dirname}/src/test/setup.ts`],
    exclude: [...defaultExclude, "./build/**"],
  },
})

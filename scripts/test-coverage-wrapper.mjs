#!/usr/bin/env node
/**
 * Wrapper around `vitest --coverage` that treats the upstream workerd
 * segfault as a success when all tests actually passed.
 *
 * @see https://github.com/cloudflare/workerd/issues/6763
 */
import { spawn } from "child_process"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const vitestPath = join(__dirname, "..", "node_modules", "vitest", "vitest.mjs")

const args = process.argv.slice(2)
const child = spawn("node", [vitestPath, "--coverage", ...args], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: false,
})

let output = ""

child.stdout.on("data", (data) => {
  output += data.toString()
  process.stdout.write(data)
})

child.stderr.on("data", (data) => {
  output += data.toString()
  process.stderr.write(data)
})

child.on("close", (code) => {
  if (code === 0) {
    process.exit(0)
  }

  const allTestsPassed =
    /Test Files\s+\d+\s+passed\s+\(\d+\)/.test(output) &&
    /Tests\s+\d+\s+passed\s+\(\d+\)/.test(output)

  const hasWorkerdSegfault =
    output.includes("Received signal #11: Segmentation fault") ||
    output.includes("Worker exited unexpectedly") ||
    output.includes("[vitest-pool]: Worker cloudflare-pool emitted error")

  if (allTestsPassed && hasWorkerdSegfault) {
    process.stderr.write(
      "\n⚠️  Detected upstream workerd segfault after all tests passed.\n" +
        "   This is a known issue (https://github.com/cloudflare/workerd/issues/6763).\n" +
        "   Treating test run as successful since no tests failed.\n",
    )
    process.exit(0)
  }

  process.exit(code ?? 1)
})

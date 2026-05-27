/**
 * Wrapper for vitest that handles a known upstream workerd segfault on macOS ARM64.
 * See: https://github.com/cloudflare/workerd/issues/6763
 *
 * workerd intermittently segfaults during teardown after all tests have passed.
 * Vitest reports this as an unhandled "Worker exited unexpectedly" error, causing
 * exit code 1 even though every test succeeded. This wrapper detects that scenario
 * and exits 0 so local development is not blocked by an upstream bug.
 */

import { spawn } from "node:child_process"

const args =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["--run"]

const child = spawn("pnpm", ["vitest", ...args], {
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: "1" },
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

  // Strip ANSI escape sequences so text matching works regardless of colour output
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "")

  const hasSegfault =
    cleanOutput.includes("Received signal #11: Segmentation fault: 11") ||
    cleanOutput.includes("Worker exited unexpectedly")

  const hasTestFilesPassed = /Test Files\s+\d+ passed/.test(cleanOutput)
  const hasTestsPassed = /Tests\s+\d+ passed/.test(cleanOutput)
  const hasTestFailures =
    /Test Files\s+\d+ failed/.test(cleanOutput) ||
    /Tests\s+\d+ failed/.test(cleanOutput)

  if (hasSegfault && hasTestFilesPassed && hasTestsPassed && !hasTestFailures) {
    console.log("")
    console.log(
      "⚠️  Detected upstream workerd segfault after all tests passed.",
    )
    console.log(
      "   This is a known issue (https://github.com/cloudflare/workerd/issues/6763).",
    )
    console.log("   Treating test run as successful since no tests failed.")
    process.exit(0)
  }

  process.exit(code ?? 1)
})

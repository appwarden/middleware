/**
 * Builds the release artifacts for the version semantic-release is about to
 * publish.
 *
 * semantic-release only knows the next version part-way through its run, so the
 * bundle would otherwise be built from the current package.json and report the
 * previous version at runtime (see src/version.ts, which feeds the heartbeat).
 *
 * This runs as a `prepare` command, which semantic-release executes before any
 * plugin publishes, so the artifacts it uploads carry the correct version.
 */

const { execFileSync } = require("node:child_process")
const path = require("node:path")

const version = process.argv[2]

if (!version) {
  console.error(
    "build-release-artifacts: expected the release version as an argument",
  )
  process.exit(1)
}

const repoRoot = path.join(__dirname, "..")

const run = (command, args, env) => {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
  })
}

console.log(`Building release artifacts for version ${version}`)

run("pnpm", ["build"], {
  NODE_ENV: "production",
  APPWARDEN_BUILD_VERSION: version,
})

run(process.execPath, [path.join(__dirname, "prepare-package.cjs")])

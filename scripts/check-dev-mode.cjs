#!/usr/bin/env node

/**
 * Checks if package.json contains dev mode exports (./build prefix)
 * Exits with code 1 if dev mode exports are found
 */

const fs = require("fs")
const path = require("path")

const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json")

function checkForDevMode() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"))

  const issues = []

  // Check main and types
  if (packageJson.main && packageJson.main.includes("./build/")) {
    issues.push(`main: ${packageJson.main}`)
  }
  if (packageJson.types && packageJson.types.includes("./build/")) {
    issues.push(`types: ${packageJson.types}`)
  }

  // Check exports
  if (packageJson.exports) {
    const exportIssues = findDevModeInExports(packageJson.exports)
    issues.push(...exportIssues)
  }

  if (issues.length > 0) {
    console.error(
      "❌ ERROR: package.json contains dev mode exports with ./build prefix:",
    )
    issues.forEach((issue) => console.error(`  - ${issue}`))
    console.error(
      "\nThis indicates the package.json is in dev mode and should not be released.",
    )
    console.error(
      "Run the prepare-package.cjs script to remove ./build prefixes before releasing.",
    )
    process.exit(1)
  }

  console.log("✅ package.json is not in dev mode (no ./build prefixes found)")
}

function findDevModeInExports(exports, path = "exports") {
  const issues = []

  if (typeof exports === "string") {
    if (exports.includes("./build/")) {
      issues.push(`${path}: ${exports}`)
    }
    return issues
  }

  if (Array.isArray(exports)) {
    exports.forEach((item, index) => {
      issues.push(...findDevModeInExports(item, `${path}[${index}]`))
    })
    return issues
  }

  if (typeof exports === "object" && exports !== null) {
    for (const [key, value] of Object.entries(exports)) {
      issues.push(...findDevModeInExports(value, `${path}.${key}`))
    }
  }

  return issues
}

checkForDevMode()

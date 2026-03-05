#!/usr/bin/env node

/**
 * Adds ./build prefix to package.json exports for dev mode
 * This allows the package to be tested locally with the build output
 */

const fs = require("fs")
const path = require("path")

const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json")

function addBuildPrefix() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"))

  // Add ./build prefix to main and types
  if (packageJson.main && !packageJson.main.startsWith("./build/")) {
    packageJson.main = packageJson.main.replace(/^\.\//, "./build/")
  }
  if (packageJson.types && !packageJson.types.startsWith("./build/")) {
    packageJson.types = packageJson.types.replace(/^\.\//, "./build/")
  }

  // Add ./build prefix to exports
  if (packageJson.exports) {
    packageJson.exports = addBuildPrefixToExports(packageJson.exports)
  }

  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + "\n",
  )
  console.log("✅ Added ./build prefix to package.json for dev mode")
}

function addBuildPrefixToExports(exports) {
  if (typeof exports === "string") {
    return exports.startsWith("./build/")
      ? exports
      : exports.replace(/^\.\//, "./build/")
  }

  if (Array.isArray(exports)) {
    return exports.map(addBuildPrefixToExports)
  }

  if (typeof exports === "object" && exports !== null) {
    const result = {}
    for (const [key, value] of Object.entries(exports)) {
      result[key] = addBuildPrefixToExports(value)
    }
    return result
  }

  return exports
}

addBuildPrefix()

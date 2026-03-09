#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json")

function removeBuildPrefix(value) {
  if (typeof value === "string") {
    return value.replace(/^\.\/build\//, "./")
  }

  if (Array.isArray(value)) {
    return value.map(removeBuildPrefix)
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        removeBuildPrefix(nestedValue),
      ]),
    )
  }

  return value
}

function exitDevMode() {
  const originalContent = fs.readFileSync(PACKAGE_JSON_PATH, "utf8")
  const packageJson = JSON.parse(originalContent)

  if (packageJson.main) {
    packageJson.main = removeBuildPrefix(packageJson.main)
  }

  if (packageJson.types) {
    packageJson.types = removeBuildPrefix(packageJson.types)
  }

  if (packageJson.exports) {
    packageJson.exports = removeBuildPrefix(packageJson.exports)
  }

  const nextContent = `${JSON.stringify(packageJson, null, 2)}\n`

  if (nextContent === originalContent) {
    console.log("ℹ️ package.json is already out of dev mode")
    return
  }

  fs.writeFileSync(PACKAGE_JSON_PATH, nextContent)
  console.log("✅ Removed ./build prefix from package.json and exited dev mode")
}

exitDevMode()

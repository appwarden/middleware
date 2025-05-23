/**
 * This script prepares the package for publishing to GitHub Packages
 * It modifies the package.json in the build directory to use the GitHub Packages registry
 */

const fs = require("fs")
const path = require("path")

// Main function
const main = () => {
  // Path to the package.json in the build directory
  const packageJsonPath = path.join(__dirname, "../build/package.json")

  // Read the current package.json
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8")
  const packageJson = JSON.parse(packageJsonContent)

  packageJson.publishConfig = {
    registry: "https://npm.pkg.github.com",
    access: "public",
    provenance: true,
  }

  // Write the modified package.json back to the build directory
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

  console.log("Package prepared for GitHub Packages publishing")
}

main()

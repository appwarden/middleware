/**
 * This script creates the .npmrc file for GitHub Packages authentication
 * It sets up the necessary authentication tokens and registry configurations
 */

const fs = require("fs")
const path = require("path")

// Main function
const main = () => {
  // Path to create the .npmrc file in the project root
  const npmrcPath = path.join(__dirname, "../.npmrc-github")

  // Create .npmrc content with proper authentication tokens
  const npmrcContent = [
    "always-auth=true",
    "//registry.npmjs.org/:_authToken=${NPM_TOKEN}",
    "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}",
    "# Make sure to use the correct scope format",
    "@appwarden:registry=https://npm.pkg.github.com",
  ].join("\n")

  // Write the .npmrc file
  fs.writeFileSync(npmrcPath, npmrcContent + "\n")

  console.log(".npmrc file created for GitHub Packages authentication")
}

main()

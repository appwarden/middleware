/**
 * This script cleans up the build directory to prepare for the second npm publish
 * It removes the .npmrc and package.json files that were created by the first npm plugin
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Main function
const main = () => {
  const buildDir = path.join(__dirname, "../build")
  
  // Remove the .npmrc file if it exists
  const npmrcPath = path.join(buildDir, ".npmrc")
  if (fs.existsSync(npmrcPath)) {
    console.log("Removing .npmrc file from build directory")
    fs.unlinkSync(npmrcPath)
  }
  
  // Remove the npm-shrinkwrap.json file if it exists
  const shrinkwrapPath = path.join(buildDir, "npm-shrinkwrap.json")
  if (fs.existsSync(shrinkwrapPath)) {
    console.log("Removing npm-shrinkwrap.json file from build directory")
    fs.unlinkSync(shrinkwrapPath)
  }
  
  // Restore the package.json from the original
  console.log("Restoring package.json from the original")
  execSync(`node ${path.join(__dirname, "prepare-package.cjs")}`)
  
  console.log("Build directory cleaned up for the second npm publish")
}

main()

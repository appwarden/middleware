/**
 * This script runs semantic-release in dry-run mode to analyze what would be released
 * if the current changes were merged to the main branch.
 *
 * It can be used locally to preview the release before creating a PR.
 */

const { execSync } = require("child_process")

// Function to execute shell commands and return output
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    }).trim()
  } catch (error) {
    if (options.ignoreError) {
      return ""
    }
    console.error(`Error executing command: ${command}`)
    console.error(error.message)
    process.exit(1)
  }
}

// Main function
async function analyzeRelease() {
  try {
    console.log("🔍 Analyzing potential release...")

    // Check if we're in a PR branch
    const currentBranch = exec("git branch --show-current", { silent: true })
    const mainBranch = "main"

    if (currentBranch === mainBranch) {
      console.warn(
        "⚠️ You are currently on the main branch. This analysis is more useful on feature branches.",
      )
    }

    // Create a temporary config file that includes the current branch
    const fs = require("fs")
    const path = require("path")
    const tempConfigPath = path.join(__dirname, "../.releaserc.temp.json")

    try {
      // Read the original .releaserc file
      const releaseRcPath = path.join(__dirname, "../.releaserc")
      const releaseRcContent = fs.readFileSync(releaseRcPath, "utf8")
      const releaseRc = JSON.parse(releaseRcContent)

      // Add the current branch to the branches configuration
      if (currentBranch !== mainBranch) {
        releaseRc.branches = ["main", currentBranch]
      }

      // Write the temporary configuration file
      fs.writeFileSync(tempConfigPath, JSON.stringify(releaseRc, null, 2))

      console.log(
        `Using temporary configuration with branches: ${JSON.stringify(releaseRc.branches)}`,
      )

      // Run semantic-release in dry-run mode with the temporary configuration
      console.log("\n📋 Running semantic-release in dry-run mode...")
      exec(`npx semantic-release --dry-run --extends ${tempConfigPath}`)
    } finally {
      // Clean up the temporary configuration file
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath)
      }
    }

    console.log("\n✅ Analysis complete!")
    console.log(
      "Note: This is a preview of what would be released if merged to main.",
    )
    console.log(
      "The actual release will be determined by the state of the main branch at merge time.",
    )
  } catch (error) {
    console.error("❌ Error analyzing release:", error)
    process.exit(1)
  }
}

// Run the main function
analyzeRelease().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})

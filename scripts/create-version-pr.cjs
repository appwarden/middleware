/**
 * This script creates a PR with version changes after a successful semantic-release
 * It's designed to work with protected branches by creating a PR instead of pushing directly
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Get the new version from command line arguments
const newVersion = process.argv[2]

if (!newVersion) {
  console.error("Error: No version provided")
  process.exit(1)
}

// Function to execute shell commands and return output
function exec(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim()
  } catch (error) {
    console.error(`Error executing command: ${command}`)
    console.error(error.message)
    process.exit(1)
  }
}

// Main function
async function createVersionPR() {
  try {
    // Create a unique branch name for the version update
    const branchName = `version-update-${newVersion}-${Date.now()}`

    // Configure git
    exec(
      'git config --local user.email "github-actions[bot]@users.noreply.github.com"',
    )
    exec('git config --local user.name "github-actions[bot]"')

    // Create a new branch
    exec(`git checkout -b ${branchName}`)

    // Update package.json with the new version
    const packageJsonPath = path.join(__dirname, "../package.json")
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    packageJson.version = newVersion
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n",
    )

    // Check if CHANGELOG.md exists and was updated by semantic-release
    const changelogPath = path.join(__dirname, "../CHANGELOG.md")
    let changelogUpdated = false

    if (fs.existsSync(changelogPath)) {
      // Check if the file was modified
      try {
        exec(`git diff --quiet -- "${changelogPath}"`)
      } catch (error) {
        // If the command exits with non-zero status, the file was modified
        changelogUpdated = true
      }
    }

    // Stage the changes
    exec(`git add "${packageJsonPath}"`)
    if (changelogUpdated) {
      exec(`git add "${changelogPath}"`)
    }

    // Commit the changes
    exec(
      `git commit -m "chore(release): update version to ${newVersion} [skip ci]"`,
    )

    // Push the branch
    exec(`git push origin ${branchName}`)

    // Create a PR using GitHub CLI
    // The GitHub CLI is already authenticated in GitHub Actions

    // Create the PR
    const prTitle = `chore(release): update version to ${newVersion}`
    const prBody = `This PR updates the package version to ${newVersion} after a successful release.\n\nThis PR was automatically created by the semantic-release process.`

    exec(
      `gh pr create --base main --head ${branchName} --title "${prTitle}" --body "${prBody}" --label "dependencies"`,
    )

    console.log(`Successfully created PR for version ${newVersion}`)
  } catch (error) {
    console.error("Error creating version PR:", error)
    process.exit(1)
  }
}

// Run the main function
createVersionPR().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})

#!/usr/bin/env node

/**
 * This script generates a coverage badge based on the test coverage report
 * It reads the coverage summary from coverage/coverage-summary.json
 * and creates a badge using shields.io
 */

const fs = require("fs")
const path = require("path")

// Paths
const COVERAGE_SUMMARY_PATH = path.join(
  __dirname,
  "../coverage/coverage-summary.json",
)
const README_PATH = path.join(__dirname, "../README.md")

// Badge colors based on coverage percentage
const getBadgeColor = (coverage) => {
  if (coverage >= 90) return "brightgreen"
  if (coverage >= 80) return "green"
  if (coverage >= 70) return "yellowgreen"
  if (coverage >= 60) return "yellow"
  if (coverage >= 50) return "orange"
  return "red"
}

// Main function
async function generateCoverageBadge() {
  try {
    // Check if coverage report exists
    if (!fs.existsSync(COVERAGE_SUMMARY_PATH)) {
      console.error("Coverage report not found. Run tests with coverage first.")
      process.exit(1)
    }

    // Read coverage data
    const coverageData = JSON.parse(
      fs.readFileSync(COVERAGE_SUMMARY_PATH, "utf8"),
    )
    const totalCoverage = coverageData.total.lines.pct

    // Generate badge URL
    const badgeColor = getBadgeColor(totalCoverage)
    const badgeUrl = `https://img.shields.io/badge/coverage-${totalCoverage}%25-${badgeColor}`

    console.log(`Coverage: ${totalCoverage}%`)
    console.log(`Badge URL: ${badgeUrl}`)

    // Update README.md with the badge
    let readmeContent = fs.readFileSync(README_PATH, "utf8")

    // Check if badge already exists
    const badgeRegex =
      /!\[Test Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-.*?%25-.*?\)/
    const badgeMarkdown = `![Test Coverage](${badgeUrl})`

    if (badgeRegex.test(readmeContent)) {
      // Replace existing badge
      readmeContent = readmeContent.replace(badgeRegex, badgeMarkdown)
    } else {
      // Add badge after the first heading
      const firstHeadingRegex = /(# .*?\n)/
      if (firstHeadingRegex.test(readmeContent)) {
        readmeContent = readmeContent.replace(
          firstHeadingRegex,
          `$1\n${badgeMarkdown}\n`,
        )
      } else {
        // If no heading found, add at the beginning
        readmeContent = `${badgeMarkdown}\n\n${readmeContent}`
      }
    }

    // Write updated README
    fs.writeFileSync(README_PATH, readmeContent)
    console.log("README.md updated with coverage badge")
  } catch (error) {
    console.error("Error generating coverage badge:", error)
    process.exit(1)
  }
}

// Run the function
generateCoverageBadge()

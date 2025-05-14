/**
 *  TODO: this whole patch can be removed when https://github.com/semantic-release/npm/pull/531 is fixed
 */

const fs = require("fs")
const path = require("path")
const { promisify } = require("util")

// Use promisified versions of fs functions to avoid race conditions
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const access = promisify(fs.access)

// Use an async IIFE to allow for proper error handling with async/await
;(async () => {
  try {
    // Determine the file path
    const filePath = path.join(
      path.dirname(require.resolve("@semantic-release/npm")),
      "/lib/publish.js",
    )

    // Check if the file exists
    try {
      await access(filePath, fs.constants.F_OK)
    } catch (error) {
      console.error("error", "cannot patch @semantic-release/npm.")
      console.error(`"${filePath}" not found`)
      return
    }

    // Read the file content
    const data = await readFile(filePath, { encoding: "utf8" })

    // Check if the file already has the patch
    if (!data.match(/cwd: basePath/gm)) {
      // Apply the patch
      const patchedData = data
        .replace("'publish', basePath,", "'publish',")
        .replace("cwd, env,", "cwd: basePath, env,")

      // Write the patched content back to the file
      await writeFile(filePath, patchedData, { encoding: "utf8" })
      console.log("success", "@semantic-release/npm patched.")
    } else {
      console.log("success", "@semantic-release/npm already patched.")
    }
  } catch (error) {
    console.error(
      "error",
      "Failed to patch @semantic-release/npm:",
      error.message,
    )
  }
})().catch((error) => {
  console.error("Unhandled error:", error)
  process.exit(1)
})

/**
 *  TODO: this whole patch can be removed when https://github.com/semantic-release/npm/pull/531 is fixed
 */

const { readFileSync, writeFileSync, existsSync } = require("fs")
const { dirname, join } = require("path")

let filePath = ""
try {
  filePath = join(
    dirname(require.resolve("@semantic-release/npm")),
    "/lib/publish.js",
  )
} catch (error) {
  console.log(error.message)

  return
}

if (existsSync(filePath)) {
  let data = readFileSync(filePath, { encoding: "utf8" })

  if (!data.match(/cwd: basePath/gm)) {
    data = data.replace("'publish', basePath,", "'publish',")
    data = data.replace("cwd, env,", "cwd: basePath, env,")
    writeFileSync(filePath, data, { encoding: "utf8" })
    console.log("success", "@semantic-release/npm patched.")
  } else {
    console.log("success", "@semantic-release/npm already patched.")
  }
} else {
  console.error("error", "cannot patch @semantic-release/npm.")
  console.error(`"${filePath}" not found`)
}

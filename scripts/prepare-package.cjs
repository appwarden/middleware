const fs = require("fs")
const path = require("path")

// read the package.json file
// copy it to build/package.json
// on the copied file, remove the `/build` substring from the from the main field
// on the copied file, remove the `/build` substring from the from the types field
const main = () => {
  const packageJson = { ...require("../package.json") }

  packageJson.main = packageJson.main.replace("/build", "")
  packageJson.types = packageJson.types.replace("/build", "")

  delete packageJson.scripts
  delete packageJson.private
  delete packageJson.sideEffects
  delete packageJson.devDependencies

  fs.writeFileSync(
    path.join(__dirname, "../build/package.json"),
    JSON.stringify(packageJson, null, 2),
  )

  fs.copyFileSync(
    path.join(__dirname, "../README.md"),
    path.join(__dirname, "../build/README.md"),
  )
}

main()

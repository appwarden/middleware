const fs = require("fs")
const path = require("path")

// read the package.json file
// copy it to build/package.json
// on the copied file, remove the `/build` substring from the from the main field
// on the copied file, remove the `/build` substring from the from the types field
const main = () => {
  // Load the package.json file
  const packageJsonPath = path.join(__dirname, "../package.json")
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8")
  const packageJson = JSON.parse(packageJsonContent)

  // Fix main and types fields
  packageJson.main = packageJson.main.replace("/build", "")
  packageJson.types = packageJson.types.replace("/build", "")

  // Remove the files field to avoid confusion
  // When publishing from the build directory, we want to include all files in that directory
  delete packageJson.files

  // Remove unnecessary fields
  delete packageJson.scripts
  delete packageJson.sideEffects
  delete packageJson.devDependencies
  // Write the modified package.json to the build directory
  fs.writeFileSync(
    path.join(__dirname, "../build/package.json"),
    JSON.stringify(packageJson, null, 2),
  )
  // Verify the changes
  console.log("Final package.json content:")
  console.log(
    fs.readFileSync(path.join(__dirname, "../build/package.json"), "utf8"),
  )
  // Copy README.md to the build directory
  fs.copyFileSync(
    path.join(__dirname, "../README.md"),
    path.join(__dirname, "../build/README.md"),
  )
  // Copy LICENSE to the build directory
  fs.copyFileSync(
    path.join(__dirname, "../LICENSE"),
    path.join(__dirname, "../build/LICENSE"),
  )
}

main()

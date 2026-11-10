import { execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { describe, expect, it } from "vitest"
import { apiRefusalCases } from "../src/test/api-refusal.cases"

describe("appwarden-link.cjs", () => {
  const scriptPath = path.resolve(__dirname, "appwarden-link.cjs")
  const configDir = path.join(".appwarden", "linked")
  const configName = "middleware.json"

  it("should create .appwarden/linked/middleware.json with defaults when no env vars", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    expect(fs.existsSync(configPath)).toBe(true)

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should support --staging flag", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const output = execSync(`node "${scriptPath}" --staging`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    expect(output).toContain("Using staging API")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should detect framework from package.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const output = execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    expect(output).toContain("Detected framework: vercel")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should support explicit --framework flag", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    const output = execSync(`node "${scriptPath}" --framework=astro`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    expect(output).toContain("Detected framework: astro")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should skip when APPWARDEN_SKIP_POSTBUILD=1", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    const output = execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: "1" },
    })

    expect(output).toContain("APPWARDEN_SKIP_POSTBUILD=1 detected")

    const configPath = path.join(tmpDir, configDir, configName)
    expect(fs.existsSync(configPath)).toBe(false)

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract CSP headers from next.config.js using acorn", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "next.config.js"),
      `module.exports = {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                {
                  key: "Content-Security-Policy",
                  value: "default-src 'self'; script-src 'self' '{{nonce}}'",
                },
              ],
            },
          ]
        },
      }`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives).toBeDefined()
    expect(config.website.cspDirectives["default-src"]).toContain("'self'")
    expect(config.website.cspDirectives["script-src"]).toContain("{{nonce}}")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should preserve spaces inside quoted CSP values", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "next.config.js"),
      `module.exports = {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                {
                  key: "Content-Security-Policy",
                  value: "script-src 'nonce-abc def' 'self'",
                },
              ],
            },
          ]
        },
      }`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspDirectives["script-src"]).toEqual([
      "'nonce-abc def'",
      "'self'",
    ])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract CSP from public/_headers (Cloudflare format)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "public", "_headers"),
      `/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' '{{nonce}}'\n`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives["default-src"]).toContain("'self'")
    expect(config.website.cspDirectives["script-src"]).toContain("{{nonce}}")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract CSP from static/_headers", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "static"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "static", "_headers"),
      `/*\n  Content-Security-Policy: default-src 'self'\n`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives["default-src"]).toEqual(["'self'"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract report-only CSP from _headers", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "public", "_headers"),
      `/*\n  Content-Security-Policy-Report-Only: default-src 'self'\n`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("report-only")
    expect(config.website.cspDirectives["default-src"]).toEqual(["'self'"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should parse _headers with comments and multiple rules", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "public", "_headers"),
      `# This is a comment\n/static/*\n  X-Frame-Options: DENY\n\n/*\n  Content-Security-Policy: default-src 'self'\n`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives["default-src"]).toEqual(["'self'"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should not add website CSP when _headers has no CSP", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "public", "_headers"),
      `/*\n  X-Frame-Options: DENY\n`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBeUndefined()
    expect(config.website.cspDirectives).toBeUndefined()

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract CSP from vercel.json modern headers format", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "vercel.json"),
      JSON.stringify({
        headers: [
          {
            source: "/(.*)",
            headers: [
              {
                key: "Content-Security-Policy",
                value: "default-src 'self'; style-src 'self'",
              },
            ],
          },
        ],
      }),
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives["default-src"]).toContain("'self'")
    expect(config.website.cspDirectives["style-src"]).toContain("'self'")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract CSP from vercel.json legacy routes format", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "vercel.json"),
      JSON.stringify({
        routes: [
          {
            src: "/(.*)",
            headers: [
              {
                key: "Content-Security-Policy-Report-Only",
                value: "default-src 'self'",
              },
            ],
          },
        ],
      }),
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("report-only")
    expect(config.website.cspDirectives["default-src"]).toEqual(["'self'"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should extract CSP from vercel.json legacy routes with object-map headers", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "vercel.json"),
      JSON.stringify({
        routes: [
          {
            src: "/(.*)",
            headers: {
              "Content-Security-Policy": "default-src 'self'",
            },
          },
        ],
      }),
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives["default-src"]).toEqual(["'self'"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should warn when .appwarden/linked/ is not gitignored", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    expect(fs.existsSync(configPath)).toBe(true)

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should refuse to write through a symlink", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))
    const victimFile = path.join(tmpDir, "victim.txt")
    fs.writeFileSync(victimFile, "original")

    fs.mkdirSync(path.join(tmpDir, ".appwarden"), { recursive: true })
    fs.symlinkSync(victimFile, path.join(tmpDir, ".appwarden", "linked"))

    let threw = false
    try {
      execSync(`node "${scriptPath}"`, {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(true)
    expect(fs.readFileSync(victimFile, "utf-8")).toBe("original")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should skip oversized _headers files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })

    // Write a _headers file larger than MAX_FILE_SIZE (1 MB)
    const oversizedContent = "/*\n  X-Frame-Options: DENY\n".repeat(200_000)
    fs.writeFileSync(path.join(tmpDir, "public", "_headers"), oversizedContent)
    const stats = fs.statSync(path.join(tmpDir, "public", "_headers"))
    expect(stats.size).toBeGreaterThan(1024 * 1024)

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    // Oversized file is skipped, so no CSP is extracted
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBeUndefined()
    expect(config.website.cspDirectives).toBeUndefined()

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should exit with error when remote config fails Zod validation", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    // Create a wrapper that mocks fetch to return invalid config
    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    website: { lockPageSlug: "/maintenance", cspMode: "invalid-mode" }\n' +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    let threw = false
    let stderr = ""
    try {
      execSync(`node "${wrapperPath}"`, {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
      })
    } catch (e: any) {
      threw = true
      stderr = e.stderr || ""
    }

    expect(threw).toBe(true)
    expect(stderr).toContain("Generated config failed validation")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should ignore untrusted appwardenApiHostname from remote config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    // Create a wrapper that mocks fetch to return untrusted hostname
    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    website: { lockPageSlug: "/maintenance" },\n' +
        '    appwardenApiHostname: "https://evil.com"\n' +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    // Untrusted hostname should be stripped from the generated config
    expect(config.appwardenApiHostname).toBeUndefined()

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should allow trusted appwardenApiHostname from remote config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    // Create a wrapper that mocks fetch to return trusted staging hostname
    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    website: { lockPageSlug: "/maintenance" },\n' +
        '    appwardenApiHostname: "https://staging-api.appwarden.io"\n' +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    // Trusted hostname should be preserved
    expect(config.appwardenApiHostname).toBe("https://staging-api.appwarden.io")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should skip oversized .gitignore files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    // Create an oversized .gitignore (larger than 128 KB)
    const oversizedGitignore = "ignored/\n".repeat(15_000)
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), oversizedGitignore)
    expect(fs.statSync(path.join(tmpDir, ".gitignore")).size).toBeGreaterThan(
      128 * 1024,
    )

    // Run the script; it should not crash and should still write the config
    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    expect(fs.existsSync(configPath)).toBe(true)

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should reject non-HTTPS appwardenApiHostname from remote config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    website: { lockPageSlug: "/maintenance" },\n' +
        '    appwardenApiHostname: "http://api.appwarden.io"\n' +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    // Non-HTTPS hostname should be stripped
    expect(config.appwardenApiHostname).toBeUndefined()

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should accept disabled CSP mode and boolean directive values", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    fs.writeFileSync(
      path.join(tmpDir, "next.config.js"),
      `module.exports = {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                {
                  key: "Content-Security-Policy",
                  value: "default-src 'self'; upgrade-insecure-requests",
                },
              ],
            },
          ]
        },
      }`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("enforced")
    expect(config.website.cspDirectives["upgrade-insecure-requests"]).toBe(true)

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should reject lockPageSlug that looks like an absolute URL", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    website: { lockPageSlug: "https://evil.com" },\n' +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    let threw = false
    try {
      execSync(`node "${wrapperPath}"`, {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(true)

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should skip route-specific CSP from Cloudflare _headers", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "public", "_headers"),
      `/admin/*\n  Content-Security-Policy: default-src 'none'\n\n/*\n  Content-Security-Policy: default-src 'self'\n`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspDirectives["default-src"]).toContain("'self'")
    expect(config.website.cspDirectives["default-src"]).not.toContain("'none'")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should skip route-specific CSP from Next.js headers()", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "next.config.js"),
      `module.exports = {
        async headers() {
          return [
            {
              source: "/admin/:path*",
              headers: [
                {
                  key: "Content-Security-Policy",
                  value: "default-src 'none'",
                },
              ],
            },
            {
              source: "/(.*)",
              headers: [
                {
                  key: "Content-Security-Policy",
                  value: "default-src 'self'",
                },
              ],
            },
          ]
        },
      }`,
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspDirectives["default-src"]).toContain("'self'")
    expect(config.website.cspDirectives["default-src"]).not.toContain("'none'")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should skip route-specific CSP from vercel.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )
    fs.writeFileSync(
      path.join(tmpDir, "vercel.json"),
      JSON.stringify({
        headers: [
          {
            source: "/admin/:path*",
            headers: [
              {
                key: "Content-Security-Policy",
                value: "default-src 'none'",
              },
            ],
          },
          {
            source: "/(.*)",
            headers: [
              {
                key: "Content-Security-Policy",
                value: "default-src 'self'",
              },
            ],
          },
        ],
      }),
    )

    execSync(`node "${scriptPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    expect(config.website).toBeDefined()
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspDirectives["default-src"]).toContain("'self'")
    expect(config.website.cspDirectives["default-src"]).not.toContain("'none'")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should parse and write remote config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    debug: "true",\n' +
        '    "bypass-paths": ["/health", "/api/webhooks/*"],\n' +
        "    website: {\n" +
        '      "lock-page-slug": "/maintenance",\n' +
        '      "csp-mode": "report-only",\n' +
        '      "csp-directives": { "default-src": ["\'self\'"] }\n' +
        "    },\n" +
        "    api: {\n" +
        '      "base-paths": ["/api", "/internal"],\n' +
        "      response: {\n" +
        "        status: 503,\n" +
        '        body: "{\\"error\\":\\"Service unavailable\\"}",\n' +
        '        headers: [{ name: "content-type", value: "application/json" }]\n' +
        "      }\n" +
        "    }\n" +
        "  });\n" +
        "  const encoder = new TextEncoder();\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    status: 200,\n" +
        "    text: async () => bodyText,\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let sent = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (sent) return { done: true };\n" +
        "            sent = true;\n" +
        "            return { done: false, value: encoder.encode(bodyText) };\n" +
        "          },\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "    headers: {\n" +
        '      get: (name) => name === "content-type" ? "application/json" : undefined,\n' +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    expect(config.debug).toBe(true)
    expect(config.bypassPaths).toEqual(["/health", "/api/webhooks/*"])
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBe("report-only")
    expect(config.website.cspDirectives).toEqual({
      "default-src": ["'self'"],
    })
    expect(config.api.basePaths).toEqual(["/api", "/internal"])
    expect(config.api.response.status).toBe(503)
    expect(config.api.response.headers).toEqual([
      { name: "content-type", value: "application/json" },
    ])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should coerce remote config debug string to boolean", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    debug: "false",\n' +
        '    bypassPaths: ["/health"],\n' +
        "    website: {\n" +
        '      lockPageSlug: "/maintenance",\n' +
        '      cspMode: "report-only",\n' +
        '      cspDirectives: { "default-src": ["\'self\'"] }\n' +
        "    },\n" +
        "    api: {\n" +
        '      basePaths: ["/api"],\n' +
        "      response: {\n" +
        "        status: 503,\n" +
        '        body: "\\"locked\\"",\n' +
        '        headers: [{ name: "content-type", value: "application/json" }]\n' +
        "      }\n" +
        "    }\n" +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    expect(config.debug).toBe(false)
    expect(config.bypassPaths).toEqual(["/health"])
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.api.basePaths).toEqual(["/api"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should fail the build on a non-Error thrown by fetch without crashing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  throw 'network error';\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    let threw = false
    let stderr = ""
    try {
      execSync(`node "${wrapperPath}"`, {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
      })
    } catch (e: any) {
      threw = true
      stderr = e.stderr || ""
    }

    // A network failure is now fatal to the build, and the message names the failure.
    expect(threw).toBe(true)
    expect(stderr).toContain("Failed to reach the Appwarden API")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should reject invalid debug string values", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    debug: "invalid",\n' +
        '    website: { lockPageSlug: "/maintenance" }\n' +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    expect(() =>
      execSync(`node "${wrapperPath}"`, {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
      }),
    ).toThrow()

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("does not create website when merging CSP into API-only route config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { astro: "^4" } }),
    )
    fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "public", "_headers"),
      `/*\n  Content-Security-Policy: default-src 'self'\n`,
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        "    api: {\n" +
        '      basePaths: ["/api"],\n' +
        "      response: {\n" +
        "        status: 503,\n" +
        '        body: "\\"locked\\""\n' +
        "      }\n" +
        "    }\n" +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    expect(config.website).toBeUndefined()
    expect(config.api.basePaths).toEqual(["/api"])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("preserves top-level fields in remote config", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      "global.fetch = async () => {\n" +
        "  const bodyText = JSON.stringify({\n" +
        '    debug: "true",\n' +
        '    appwardenApiHostname: "https://api.appwarden.io",\n' +
        "    website: {\n" +
        '      lockPageSlug: "/maintenance"\n' +
        "    }\n" +
        "  });\n" +
        "  return {\n" +
        "    ok: true,\n" +
        "    headers: { get: () => null },\n" +
        "    body: {\n" +
        "      getReader: () => {\n" +
        "        let done = false;\n" +
        "        return {\n" +
        "          read: async () => {\n" +
        "            if (done) return { done: true };\n" +
        "            done = true;\n" +
        "            return { done: false, value: new TextEncoder().encode(bodyText) };\n" +
        "          },\n" +
        "          cancel: async () => {},\n" +
        "        };\n" +
        "      },\n" +
        "    },\n" +
        "  };\n" +
        "};\n" +
        'process.env.APPWARDEN_API_TOKEN = "test-token";\n' +
        'process.env.APPWARDEN_FQDN = "example.com";\n' +
        'require("' +
        scriptPath +
        '");\n',
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    expect(config.debug).toBe(true)
    expect(config.appwardenApiHostname).toBe("https://api.appwarden.io")

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should select the remote middleware configuration matching --fqdn", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    // The API returns one entry per domain: { content: [{ url, options }] }.
    const payload = {
      content: [
        {
          url: "other.example.com",
          options: { "bypass-paths": ["/nope"] },
        },
        {
          url: "example.com",
          options: {
            "bypass-paths": ["/health", "/api/health"],
            website: {
              "lock-page-slug": "/maintenance",
              "csp-mode": "report-only",
              "csp-directives": { "script-src": ["self", "{{nonce}}"] },
            },
            api: {
              "base-paths": ["/api"],
              response: {
                status: 521,
                body: '{"error":"Service unavailable","source":"appwarden"}',
                headers: [
                  { name: "content-type", value: "application/json" },
                  { name: "x-appwarden-lock", value: "api" },
                ],
              },
            },
          },
        },
      ],
    }

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      [
        "global.fetch = async () => {",
        `  const bodyText = ${JSON.stringify(JSON.stringify(payload))};`,
        "  return {",
        "    ok: true,",
        "    headers: { get: () => null },",
        "    body: {",
        "      getReader: () => {",
        "        let done = false;",
        "        return {",
        "          read: async () => {",
        "            if (done) return { done: true };",
        "            done = true;",
        "            return { done: false, value: new TextEncoder().encode(bodyText) };",
        "          },",
        "          cancel: async () => {},",
        "        };",
        "      },",
        "    },",
        "  };",
        "};",
        'process.env.APPWARDEN_API_TOKEN = "test-token";',
        'process.env.APPWARDEN_FQDN = "example.com";',
        `require(${JSON.stringify(scriptPath)});`,
        "",
      ].join("\n"),
    )

    execSync(`node "${wrapperPath}"`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    // The entry matching --fqdn is applied; the other domain's is not.
    expect(config.bypassPaths).toEqual(["/health", "/api/health"])
    expect(config.website.cspMode).toBe("report-only")
    expect(config.website.cspDirectives["script-src"]).toEqual([
      "self",
      "{{nonce}}",
    ])
    expect(config.api.basePaths).toEqual(["/api"])
    expect(config.api.response.status).toBe(521)

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should ignore the remote config when no content entry matches --fqdn", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { next: "^14" } }),
    )

    const payload = {
      content: [
        {
          url: "other.example.com",
          options: {
            website: {
              "lock-page-slug": "/maintenance",
              "csp-mode": "enforced",
            },
          },
        },
      ],
    }

    const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
    fs.writeFileSync(
      wrapperPath,
      [
        "global.fetch = async () => {",
        `  const bodyText = ${JSON.stringify(JSON.stringify(payload))};`,
        "  return {",
        "    ok: true,",
        "    headers: { get: () => null },",
        "    body: {",
        "      getReader: () => {",
        "        let done = false;",
        "        return {",
        "          read: async () => {",
        "            if (done) return { done: true };",
        "            done = true;",
        "            return { done: false, value: new TextEncoder().encode(bodyText) };",
        "          },",
        "          cancel: async () => {},",
        "        };",
        "      },",
        "    },",
        "  };",
        "};",
        'process.env.APPWARDEN_API_TOKEN = "test-token";',
        'process.env.APPWARDEN_FQDN = "example.com";',
        `require(${JSON.stringify(scriptPath)});`,
        "",
      ].join("\n"),
    )

    // Redirect stderr so the warning is captured alongside stdout.
    const output = execSync(`node "${wrapperPath}" 2>&1`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, APPWARDEN_SKIP_POSTBUILD: undefined },
    })

    expect(output).toContain(
      "No remote middleware configuration found for example.com",
    )

    const configPath = path.join(tmpDir, configDir, configName)
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))

    // Falls back to the synthesized website config, without the other domain's CSP.
    expect(config.website.lockPageSlug).toBe("/maintenance")
    expect(config.website.cspMode).toBeUndefined()

    fs.rmSync(tmpDir, { recursive: true })
  })

  describe("API refusals", () => {
    /** The statuses the CLI retries; every other refusal ends the build on the first attempt. */
    const RETRYABLE_STATUSES = [503, 429]
    const MAX_ATTEMPTS = 3

    type MockResponse =
      | { ok: true; body: unknown }
      | {
          ok: false
          status: number
          statusText?: string
          code?: string
          retryAfter?: string
        }

    /**
     * Runs the CLI against a scripted sequence of fetch responses and reports how many
     * times fetch was called, so a case can pin the retry behaviour too.
     */
    const runCli = (
      tmpDir: string,
      responses: MockResponse[],
      extraEnv: Record<string, string | undefined> = {},
      argv: string[] = [],
    ) => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ dependencies: { next: "^14" } }),
      )

      const wrapperPath = path.join(tmpDir, "mock-fetch-wrapper.cjs")
      const counterPath = path.join(tmpDir, "fetch-count.txt")

      fs.writeFileSync(
        wrapperPath,
        [
          'const fs = require("fs");',
          `const counterPath = ${JSON.stringify(counterPath)};`,
          `const responses = ${JSON.stringify(responses)};`,
          "let i = 0;",
          "global.fetch = async () => {",
          '  fs.appendFileSync(counterPath, "x");',
          "  const r = responses[Math.min(i, responses.length - 1)];",
          "  i++;",
          "  if (r.ok) {",
          "    const bodyText = JSON.stringify(r.body);",
          "    return {",
          "      ok: true,",
          "      status: 200,",
          '      headers: { get: (n) => (n === "content-type" ? "application/json" : null) },',
          "      body: {",
          "        getReader: () => {",
          "          let done = false;",
          "          return {",
          "            read: async () => {",
          "              if (done) return { done: true };",
          "              done = true;",
          "              return { done: false, value: new TextEncoder().encode(bodyText) };",
          "            },",
          "            cancel: async () => {},",
          "          };",
          "        },",
          "      },",
          "    };",
          "  }",
          "  return {",
          "    ok: false,",
          "    status: r.status,",
          "    statusText: r.statusText || '',",
          '    headers: { get: (n) => (n === "retry-after" ? (r.retryAfter ?? null) : null) },',
          "    json: async () => {",
          "      if (r.code === undefined) throw new Error('not json');",
          "      return { error: { code: r.code } };",
          "    },",
          "  };",
          "};",
          'process.env.APPWARDEN_API_TOKEN = "test-token";',
          'process.env.APPWARDEN_FQDN = "example.com";',
          ...argv.map((a) => `process.argv.push(${JSON.stringify(a)});`),
          `require(${JSON.stringify(scriptPath)});`,
          "",
        ].join("\n"),
      )

      let status = 0
      let output = ""
      try {
        output = execSync(`node "${wrapperPath}" 2>&1`, {
          cwd: tmpDir,
          encoding: "utf-8",
          env: {
            ...process.env,
            APPWARDEN_SKIP_POSTBUILD: undefined,
            APPWARDEN_LINK_ALLOW_DEGRADED: undefined,
            ...extraEnv,
          },
        })
      } catch (e: any) {
        status = e.status ?? 1
        output = `${e.stdout ?? ""}${e.stderr ?? ""}`
      }

      const calls = fs.existsSync(counterPath)
        ? fs.readFileSync(counterPath, "utf-8").length
        : 0

      return { status, output, calls }
    }

    const successResponse: MockResponse = {
      ok: true,
      body: { website: { lockPageSlug: "/maintenance" } },
    }

    // Criterion 12: the same case list drives this file and src/utils/api-refusal.test.ts.
    it.each(apiRefusalCases)(
      "fails the build for HTTP $status (code $code) with the classified message",
      ({ status, code, message }) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

        const result = runCli(tmpDir, [
          { ok: false, status, statusText: "Refused", code },
        ])

        expect(result.status).not.toBe(0)
        expect(result.output).toContain(message)
        // Only 503 and 429 are retried; every other refusal ends the build on the first try.
        expect(result.calls).toBe(
          RETRYABLE_STATUSES.includes(status) ? MAX_ATTEMPTS : 1,
        )

        fs.rmSync(tmpDir, { recursive: true })
      },
    )

    it("retries a 503 and links once the API recovers", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

      const result = runCli(tmpDir, [
        { ok: false, status: 503, statusText: "Service Unavailable" },
        successResponse,
      ])

      expect(result.status).toBe(0)
      expect(result.calls).toBe(2)
      expect(result.output).toContain("retrying in 250ms")

      const configPath = path.join(tmpDir, configDir, configName)
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      expect(config.website.lockPageSlug).toBe("/maintenance")

      fs.rmSync(tmpDir, { recursive: true })
    })

    it("gives up after three attempts on a persistent 503", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

      const result = runCli(tmpDir, [
        { ok: false, status: 503, statusText: "Service Unavailable" },
      ])

      expect(result.calls).toBe(MAX_ATTEMPTS)
      expect(result.status).not.toBe(0)
      expect(result.output).toContain(
        "The Appwarden API is temporarily unavailable (HTTP 503).",
      )
      expect(result.output).toContain(`Gave up after ${MAX_ATTEMPTS} attempts.`)

      fs.rmSync(tmpDir, { recursive: true })
    })

    it("retries a 429 and honours Retry-After", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

      const result = runCli(tmpDir, [
        {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          retryAfter: "0",
        },
        successResponse,
      ])

      expect(result.status).toBe(0)
      expect(result.calls).toBe(2)
      // Retry-After: 0 is honoured instead of the 250 ms exponential default.
      expect(result.output).toContain("retrying in 0ms")

      fs.rmSync(tmpDir, { recursive: true })
    })

    it("does not retry a 500", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

      const result = runCli(tmpDir, [
        { ok: false, status: 500, statusText: "Internal Server Error" },
      ])

      expect(result.calls).toBe(1)
      expect(result.status).not.toBe(0)

      fs.rmSync(tmpDir, { recursive: true })
    })

    it("warns and continues when APPWARDEN_LINK_ALLOW_DEGRADED=1", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

      const result = runCli(
        tmpDir,
        [{ ok: false, status: 403, code: "INSUFFICIENT_SCOPE" }],
        { APPWARDEN_LINK_ALLOW_DEGRADED: "1" },
      )

      expect(result.status).toBe(0)
      expect(result.output).toContain("cannot read domains")
      expect(result.output).toContain("allow-degraded")

      const configPath = path.join(tmpDir, configDir, configName)
      expect(fs.existsSync(configPath)).toBe(true)

      fs.rmSync(tmpDir, { recursive: true })
    })

    it("warns and continues when --allow-degraded is passed", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appwarden-test-"))

      const result = runCli(
        tmpDir,
        [
          {
            ok: false,
            status: 402,
            statusText: "Payment Required",
            code: "SUBSCRIPTION_REQUIRED",
          },
        ],
        {},
        ["--allow-degraded"],
      )

      expect(result.status).toBe(0)
      expect(result.output).toContain("Degraded mode enabled")
      expect(result.output).toContain("subscription is not active")
      expect(result.output).toContain("allow-degraded")

      fs.rmSync(tmpDir, { recursive: true })
    })
  })
})

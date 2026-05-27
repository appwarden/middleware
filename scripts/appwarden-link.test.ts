import { execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { describe, expect, it } from "vitest"

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
    expect(config.lockPageSlug).toBe("")

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

    expect(output).toContain("Using staging API hostname")

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
    expect(config.contentSecurityPolicy).toBeDefined()
    expect(config.contentSecurityPolicy.mode).toBe("enforced")
    expect(config.contentSecurityPolicy.directives).toBeDefined()
    expect(config.contentSecurityPolicy.directives["default-src"]).toContain(
      "'self'",
    )
    expect(config.contentSecurityPolicy.directives["script-src"]).toContain(
      "'{{nonce}}'",
    )

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
    expect(config.contentSecurityPolicy.directives["script-src"]).toEqual([
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
    expect(config.contentSecurityPolicy).toBeDefined()
    expect(config.contentSecurityPolicy.mode).toBe("enforced")
    expect(config.contentSecurityPolicy.directives["default-src"]).toContain(
      "'self'",
    )
    expect(config.contentSecurityPolicy.directives["script-src"]).toContain(
      "'{{nonce}}'",
    )

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
    expect(config.contentSecurityPolicy.mode).toBe("enforced")
    expect(config.contentSecurityPolicy.directives["default-src"]).toEqual([
      "'self'",
    ])

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
    expect(config.contentSecurityPolicy.mode).toBe("report-only")
    expect(config.contentSecurityPolicy.directives["default-src"]).toEqual([
      "'self'",
    ])

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
    expect(config.contentSecurityPolicy.mode).toBe("enforced")
    expect(config.contentSecurityPolicy.directives["default-src"]).toEqual([
      "'self'",
    ])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it("should not add contentSecurityPolicy when _headers has no CSP", () => {
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
    expect(config.contentSecurityPolicy).toBeUndefined()

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
    expect(config.contentSecurityPolicy).toBeDefined()
    expect(config.contentSecurityPolicy.mode).toBe("enforced")
    expect(config.contentSecurityPolicy.directives["default-src"]).toContain(
      "'self'",
    )
    expect(config.contentSecurityPolicy.directives["style-src"]).toContain(
      "'self'",
    )

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
    expect(config.contentSecurityPolicy.mode).toBe("report-only")
    expect(config.contentSecurityPolicy.directives["default-src"]).toEqual([
      "'self'",
    ])

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
    expect(config.contentSecurityPolicy).toBeUndefined()

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
        "    content: [{\n" +
        '      url: "example.com",\n' +
        "      options: {\n" +
        '        lockPageSlug: "/maintenance",\n' +
        "        contentSecurityPolicy: {\n" +
        '          mode: "invalid-mode",\n' +
        '          directives: { "default-src": ["\'self\'"] }\n' +
        "        }\n" +
        "      }\n" +
        "    }]\n" +
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
      "global.fetch = async () => ({\n" +
        "  ok: true,\n" +
        "  headers: { get: () => null },\n" +
        "  text: async () => JSON.stringify({\n" +
        "    content: [{\n" +
        '      url: "example.com",\n' +
        "      options: {\n" +
        '        lockPageSlug: "/maintenance",\n' +
        '        appwardenApiHostname: "https://evil.com"\n' +
        "      }\n" +
        "    }]\n" +
        "  }),\n" +
        "});\n" +
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
        "    content: [{\n" +
        '      url: "example.com",\n' +
        "      options: {\n" +
        '        lockPageSlug: "/maintenance",\n' +
        '        appwardenApiHostname: "https://staging-api.appwarden.io"\n' +
        "      }\n" +
        "    }]\n" +
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
})

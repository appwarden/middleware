#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")
const acorn = require("acorn")
const { z } = require("zod")

const CONFIG_PATH = ".appwarden/linked/middleware.json"
const GITIGNORE_WARNING =
  "Warning: .appwarden/linked/ is not gitignored. Add it to .gitignore to avoid checking generated config into version control."
const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1 MB
const MAX_GITIGNORE_SIZE = 128 * 1024 // 128 KB
const MAX_REMOTE_RESPONSE_SIZE = 1 * 1024 * 1024 // 1 MB
const ALLOWED_FRAMEWORKS = [
  "astro",
  "react-router",
  "tanstack-start",
  "nextjs-cloudflare",
  "vercel",
]
const ALLOWED_REMOTE_CONFIG_KEYS = [
  "lockPageSlug",
  "debug",
  "contentSecurityPolicy",
  "appwardenApiHostname",
]

const ALLOWED_API_HOSTNAMES = ["api.appwarden.io", "staging-api.appwarden.io"]

const CSP_ENFORCED = "content-security-policy"
const CSP_REPORT_ONLY = "content-security-policy-report-only"

function isCspHeader(name) {
  return name === CSP_ENFORCED || name === CSP_REPORT_ONLY
}

function isGlobalRoute(route) {
  if (typeof route !== "string") return false
  const trimmed = route.trim()
  // Cloudflare catch-all routes
  if (trimmed === "/*" || trimmed === "/") return true
  // Next.js / Vercel catch-all patterns
  if (trimmed === "/(.*)" || trimmed === "/:path*" || trimmed === "/:path+")
    return true
  return false
}

const BuildOutputSchema = z.object({
  lockPageSlug: z
    .string()
    .refine(
      (val) =>
        !val.includes("://") && !val.startsWith("//") && !val.includes("\\"),
      {
        message: "lockPageSlug must be a relative path",
      },
    ),
  debug: z.boolean().optional(),
  appwardenApiHostname: z.string().optional(),
  contentSecurityPolicy: z
    .object({
      mode: z.enum(["disabled", "enforced", "report-only"]),
      directives: z.record(
        z.union([z.string(), z.array(z.string()), z.boolean()]),
      ),
    })
    .optional(),
})

const CYAN = "\x1b[36m"
const YELLOW = "\x1b[33m"

const print = (...args) => console.log(`${CYAN}[appwarden]`, ...args)
const warn = (...args) => console.warn(`${YELLOW}[appwarden]`, ...args)

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {
    framework: null,
    staging: false,
    cwd: process.cwd(),
    fqdn: null,
  }
  for (const arg of args) {
    const frameworkMatch = arg.match(/^--framework=(.+)$/)
    if (frameworkMatch) {
      const fw = frameworkMatch[1]
      if (ALLOWED_FRAMEWORKS.includes(fw)) {
        result.framework = fw
      } else {
        warn(`Ignoring unsupported framework: ${fw}`)
      }
    }
    if (arg === "--staging") result.staging = true

    const cwdMatch = arg.match(/^--cwd=(.+)$/)
    if (cwdMatch) {
      const resolved = path.resolve(cwdMatch[1])
      const relativeToProcess = path.relative(process.cwd(), resolved)
      if (
        relativeToProcess.startsWith("..") ||
        path.isAbsolute(relativeToProcess)
      ) {
        warn(
          `Ignoring --cwd that escapes process working directory: ${cwdMatch[1]}`,
        )
      } else {
        result.cwd = resolved
      }
    }

    const fqdnMatch = arg.match(/^--fqdn=(.+)$/)
    if (fqdnMatch) result.fqdn = fqdnMatch[1]
  }
  return result
}

function detectFramework(cwd, explicit) {
  if (explicit) return explicit
  const pkgPath = path.join(cwd, "package.json")
  const pkgContent = safeReadFile(pkgPath, cwd)
  if (!pkgContent) return null
  try {
    const pkg = JSON.parse(pkgContent)
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    }
    if (deps["astro"]) return "astro"
    if (deps["@react-router/cloudflare"]) return "react-router"
    if (
      deps["@tanstack/start"] ||
      deps["@tanstack/react-start"] ||
      deps["@tanstack/solid-start"] ||
      deps["@tanstack/vue-start"] ||
      deps["@tanstack/svelte-start"]
    )
      return "tanstack-start"
    if (deps["@opennextjs/cloudflare"]) return "nextjs-cloudflare"
    if (deps["next"]) return "vercel"
    return null
  } catch {
    return null
  }
}

function findNextConfig(cwd) {
  // Only .js/.mjs because extractHeadersFromNextConfig uses plain Acorn,
  // which cannot parse TypeScript syntax.
  const candidates = ["next.config.js", "next.config.mjs"]
  for (const c of candidates) {
    const p = path.join(cwd, c)
    if (fs.existsSync(p)) return p
  }
  return null
}

function extractHeadersFromNextConfig(source) {
  let ast
  try {
    ast = acorn.parse(source, {
      ecmaVersion: 2023,
      sourceType: "module",
      allowReturnOutsideFunction: true,
    })
  } catch {
    try {
      ast = acorn.parse(source, {
        ecmaVersion: 2023,
        sourceType: "script",
        allowReturnOutsideFunction: true,
      })
    } catch {
      return []
    }
  }

  const result = []
  const visited = new Set()
  const MAX_WALK_DEPTH = 500

  function walk(node, inHeadersFn, depth = 0) {
    if (!node || typeof node !== "object") return
    if (visited.has(node)) return
    if (depth > MAX_WALK_DEPTH) return
    visited.add(node)

    if (
      inHeadersFn &&
      node.type === "ReturnStatement" &&
      node.argument &&
      node.argument.type === "ArrayExpression"
    ) {
      for (const el of node.argument.elements || []) {
        if (!el || el.type !== "ObjectExpression") continue
        let sourceValue = null
        for (const prop of el.properties || []) {
          if (
            prop.type === "Property" &&
            prop.key &&
            (prop.key.name === "source" || prop.key.value === "source") &&
            prop.value &&
            prop.value.type === "Literal"
          ) {
            sourceValue = prop.value.value
            break
          }
        }
        if (sourceValue && !isGlobalRoute(sourceValue)) {
          warn(
            `Skipping route-specific CSP from Next.js source: ${sourceValue}`,
          )
          continue
        }
        for (const prop of el.properties || []) {
          if (
            prop.type === "Property" &&
            prop.key &&
            (prop.key.name === "headers" || prop.key.value === "headers") &&
            prop.value &&
            prop.value.type === "ArrayExpression"
          ) {
            for (const h of prop.value.elements || []) {
              if (!h || h.type !== "ObjectExpression") continue
              let key = null
              let value = null
              for (const hp of h.properties || []) {
                if (hp.type !== "Property" || !hp.key) continue
                const kName = hp.key.name || hp.key.value
                if (
                  kName === "key" &&
                  hp.value &&
                  hp.value.type === "Literal"
                ) {
                  key = hp.value.value
                }
                if (
                  kName === "value" &&
                  hp.value &&
                  hp.value.type === "Literal"
                ) {
                  value = hp.value.value
                }
              }
              if (key !== null && value !== null) {
                result.push({ key, value })
              }
            }
          }
        }
      }
      return
    }

    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      const isHeaders = node.id && node.id.name === "headers"
      const newInHeaders = inHeadersFn || isHeaders
      for (const k of Object.keys(node)) {
        if (k === "id" || k === "params") continue
        walk(node[k], newInHeaders, depth + 1)
      }
      return
    }

    if (
      node.type === "Property" &&
      node.key &&
      (node.key.name === "headers" || node.key.value === "headers")
    ) {
      if (
        node.value &&
        (node.value.type === "FunctionExpression" ||
          node.value.type === "ArrowFunctionExpression")
      ) {
        walk(node.value, true, depth + 1)
        return
      }
    }

    for (const k of Object.keys(node)) {
      if (k === "parent") continue
      walk(node[k], inHeadersFn, depth + 1)
    }
  }

  walk(ast, false)
  return result
}

function splitCspTokens(value) {
  const tokens = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === "'") {
      inQuotes = !inQuotes
      current += ch
      continue
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

function parseCspHeaderValue(value) {
  const directives = Object.create(null)
  if (!value || typeof value !== "string") return directives
  const parts = value.split(/;\s*/)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const firstSpace = trimmed.indexOf(" ")
    const name = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
    const directiveValue =
      firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim()
    if (!directiveValue) {
      directives[name] = true
    } else {
      directives[name] = splitCspTokens(directiveValue).map((token) => {
        // Normalize quoted nonce placeholders so downstream makeCSPHeader
        // does not produce double-quoted nonce sources.
        if (token === "'{{nonce}}'" || token === '"{{nonce}}"') {
          return "{{nonce}}"
        }
        return token
      })
    }
  }
  return directives
}

function parseCloudflareHeaders(content) {
  const lines = content.split(/\r?\n/)
  const result = []
  let currentRoute = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      // This is a route line, not an indented header
      currentRoute = trimmed
      continue
    }
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx === -1) continue
    const name = trimmed.slice(0, colonIdx).trim().toLowerCase()
    const value = trimmed.slice(colonIdx + 1).trim()
    if (isCspHeader(name)) {
      if (currentRoute && !isGlobalRoute(currentRoute)) {
        warn(
          `Skipping route-specific CSP from non-global route: ${currentRoute}`,
        )
        continue
      }
      result.push({ key: name, value })
    }
  }
  return result
}

function pushCspHeaders(headers, rawHeaders) {
  for (const h of rawHeaders || []) {
    const key = (h.key || "").toLowerCase()
    if (isCspHeader(key)) {
      headers.push({ key: h.key, value: h.value })
    }
  }
}

function safeReadFile(filePath, cwd) {
  if (!filePath) return null
  try {
    const resolved = fs.realpathSync(filePath)
    const root = path.resolve(cwd)
    const relative = path.relative(root, resolved)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      warn(`Skipping file outside project: ${filePath}`)
      return null
    }
    const fd = fs.openSync(resolved, "r")
    try {
      const stats = fs.fstatSync(fd)
      if (!stats.isFile()) {
        warn(`Skipping non-file path: ${filePath}`)
        return null
      }
      if (stats.size > MAX_FILE_SIZE) {
        warn(`Skipping oversized file: ${filePath}`)
        return null
      }
      return fs.readFileSync(fd, "utf-8")
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

function safeWriteFile(filePath, content, cwd) {
  try {
    const root = fs.realpathSync(path.resolve(cwd))
    const target = path.resolve(filePath)
    const relative = path.relative(root, target)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      warn(`Refusing to write outside project: ${filePath}`)
      return false
    }

    // Walk up the path and verify no existing component is a symlink
    let current = target
    while (current !== root && current !== path.dirname(current)) {
      if (fs.existsSync(current)) {
        const stat = fs.lstatSync(current)
        if (stat.isSymbolicLink()) {
          warn(`Refusing to write through symlink: ${current}`)
          return false
        }
      }
      current = path.dirname(current)
    }

    const dir = path.dirname(target)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Re-verify directory path after mkdir to catch symlink races in parent dirs
    const resolvedDir = fs.realpathSync(dir)
    const dirRelative = path.relative(root, resolvedDir)
    if (dirRelative.startsWith("..") || path.isAbsolute(dirRelative)) {
      warn(`Refusing to write outside project: ${dir}`)
      return false
    }

    // Atomic write: temp file in same directory, then rename
    const tempFile = path.join(
      dir,
      `.appwarden-link-tmp-${process.hrtime.bigint().toString(36)}.json`,
    )

    fs.writeFileSync(tempFile, content, { mode: 0o600 })
    fs.renameSync(tempFile, target)

    // Final verification: ensure the written file is a regular file inside the
    // project. The nlink > 1 check specifically defends against a race where an
    // attacker creates a hard link to the temp file in the same directory between
    // writeFileSync and renameSync; it does not protect against a pre-existing
    // hard-linked target because rename atomically swaps inodes.
    const finalStat = fs.lstatSync(target)
    if (!finalStat.isFile() || finalStat.nlink > 1) {
      warn(`Refusing to write through link: ${target}`)
      return false
    }

    const finalResolved = fs.realpathSync(target)
    const finalRelative = path.relative(root, finalResolved)
    if (finalRelative.startsWith("..") || path.isAbsolute(finalRelative)) {
      warn(`Refusing to write outside project: ${target}`)
      return false
    }

    return true
  } catch (err) {
    warn(`Failed to write config: ${err.message}`)
    return false
  }
}

function extractLocalHeadersConfig(cwd, framework) {
  const headers = []
  const nextConfig = findNextConfig(cwd)
  const nextConfigSource = safeReadFile(nextConfig, cwd)
  if (nextConfigSource) {
    headers.push(...extractHeadersFromNextConfig(nextConfigSource))
  }
  const vercelJson = path.join(cwd, "vercel.json")
  const vercelJsonContent = safeReadFile(vercelJson, cwd)
  if (vercelJsonContent) {
    try {
      const vj = JSON.parse(vercelJsonContent)
      for (const rule of [...(vj.headers || []), ...(vj.routes || [])]) {
        const route = rule.source || rule.src || ""
        if (route && !isGlobalRoute(route)) {
          warn(`Skipping route-specific CSP from vercel.json rule: ${route}`)
          continue
        }
        // Legacy vercel.json routes[] may use an object map for headers
        let ruleHeaders = rule.headers
        if (ruleHeaders && !Array.isArray(ruleHeaders)) {
          ruleHeaders = Object.entries(ruleHeaders).map(([key, value]) => ({
            key,
            value,
          }))
        }
        pushCspHeaders(headers, ruleHeaders)
      }
    } catch {}
  }
  const publicHeaders = path.join(cwd, "public", "_headers")
  const staticHeaders = path.join(cwd, "static", "_headers")
  const distHeaders = path.join(cwd, "dist", "_headers")
  const buildHeaders = path.join(cwd, "build", "_headers")
  const nextHeaders = path.join(cwd, ".next", "_headers")
  for (const hp of [
    publicHeaders,
    staticHeaders,
    distHeaders,
    buildHeaders,
    nextHeaders,
  ]) {
    const content = safeReadFile(hp, cwd)
    if (content) {
      headers.push(...parseCloudflareHeaders(content))
    }
  }
  if (!headers.length) return null
  const enforced = headers.find((h) => h.key.toLowerCase() === CSP_ENFORCED)
  const reportOnly = headers.find(
    (h) => h.key.toLowerCase() === CSP_REPORT_ONLY,
  )
  if (enforced) {
    return { mode: "enforced", directives: parseCspHeaderValue(enforced.value) }
  }
  if (reportOnly) {
    return {
      mode: "report-only",
      directives: parseCspHeaderValue(reportOnly.value),
    }
  }
  return null
}

function isAllowedApiHostname(value) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" && ALLOWED_API_HOSTNAMES.includes(url.hostname)
    )
  } catch {
    return false
  }
}

function mapKeys(obj, transform) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return obj
  }
  const result = Object.create(null)
  for (const [key, value] of Object.entries(obj)) {
    result[transform(key)] = value
  }
  return result
}

const normalizeRemoteConfigKeys = (obj) =>
  mapKeys(obj, (key) => key.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase()))

const kebabCaseDirectives = (obj) =>
  mapKeys(obj, (key) => key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())

function sanitizeRemoteConfig(data, depth = 0) {
  if (depth > 5) {
    warn("Remote config nested too deeply. Truncating.")
    return null
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    warn("Remote config response was not a valid object. Ignoring.")
    return null
  }
  const safe = Object.create(null)
  for (const key of Object.keys(data)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue
    }
    // Top-level keys must be explicitly allowlisted
    if (depth === 0 && !ALLOWED_REMOTE_CONFIG_KEYS.includes(key)) {
      warn(`Ignoring unexpected remote config key: ${key}`)
      continue
    }
    const val = data[key]
    // Reject untrusted API hostnames to prevent token exfiltration
    if (
      key === "appwardenApiHostname" &&
      typeof val === "string" &&
      !isAllowedApiHostname(val)
    ) {
      warn(`Ignoring invalid appwardenApiHostname: ${val}`)
      continue
    }
    // Only accept primitive values, arrays of strings, and plain objects
    if (val === null || val === undefined) {
      safe[key] = val
    } else if (
      typeof val === "string" ||
      typeof val === "boolean" ||
      typeof val === "number"
    ) {
      safe[key] = val
    } else if (Array.isArray(val) && val.every((v) => typeof v === "string")) {
      safe[key] = val
    } else if (typeof val === "object") {
      // Recursively sanitize nested objects (e.g. contentSecurityPolicy.directives)
      const nested = sanitizeRemoteConfig(val, depth + 1)
      if (nested) safe[key] = nested
    }
  }
  return safe
}

async function fetchRemoteConfig(apiToken, apiHostname, fqdn) {
  if (!apiToken || !fqdn) return null
  if (
    typeof fqdn !== "string" ||
    !fqdn.trim() ||
    /[\/\\]/.test(fqdn) ||
    fqdn.includes("..")
  ) {
    warn("Invalid FQDN provided. Skipping.")
    return null
  }

  const url = new URL("/v1/appwarden/config", apiHostname)
  url.searchParams.set("fqdn", fqdn)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  const href = url.toString()
  try {
    const res = await fetch(href, {
      headers: { Authorization: apiToken },
      signal: controller.signal,
    })
    if (!res.ok) {
      warn(`fetch failed: ${href} ${res.status} ${res.statusText}`)
      return null
    }
    const contentLength = res.headers.get("content-length")
    if (
      contentLength &&
      parseInt(contentLength, 10) > MAX_REMOTE_RESPONSE_SIZE
    ) {
      warn(`Remote response too large: ${contentLength} bytes`)
      return null
    }
    let text = ""
    let bytes = 0
    const reader = res.body.getReader()
    const decoder = new TextDecoder("utf-8")
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > MAX_REMOTE_RESPONSE_SIZE) {
        warn("Remote response body too large")
        try {
          await reader.cancel()
        } catch {}
        return null
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()

    const data = JSON.parse(text)

    // The API returns { content: [{ url, options }] } — extract the config object
    let config = null
    if (data && Array.isArray(data.content)) {
      const entry = data.content.find(
        (item) =>
          item.url === fqdn ||
          item.url === `www.${fqdn}` ||
          fqdn === `www.${item.url}`,
      )
      config = entry?.options ?? null
    } else if (data && typeof data === "object" && !Array.isArray(data)) {
      // Fallback: API returned a flat object directly
      config = data
    }

    if (config) {
      config = normalizeRemoteConfigKeys(config)
      // Normalize API-specific CSP keys into the middleware shape
      if (config.cspMode || config.cspDirectives) {
        config.contentSecurityPolicy = {
          mode: config.cspMode || "report-only",
          directives: kebabCaseDirectives(config.cspDirectives) || {},
        }
        delete config.cspMode
        delete config.cspDirectives
      }
    }

    return sanitizeRemoteConfig(config)
  } catch (err) {
    warn(`fetch error: ${href} ${err.message}`)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function mergeConfigs(remote, localHeaders) {
  const merged = Object.create(null)
  if (remote && typeof remote === "object") {
    for (const key of Object.keys(remote)) {
      merged[key] = remote[key]
    }
  }
  if (localHeaders) {
    merged.contentSecurityPolicy = localHeaders
  }
  return merged
}

function checkGitignore(cwd) {
  if (process.env.APPWARDEN_SKIP_GITIGNORE_CHECK === "1") return true
  let current = path.resolve(cwd)
  const root = path.parse(current).root
  while (current !== root) {
    const gitignorePath = path.join(current, ".gitignore")
    try {
      const resolved = fs.realpathSync(gitignorePath)
      const resolvedDir = fs.realpathSync(current)
      if (path.dirname(resolved) !== resolvedDir) {
        warn(`Skipping suspicious gitignore symlink: ${resolved}`)
        return false
      }
      if (!resolved.endsWith(path.sep + ".gitignore")) {
        warn(`Skipping suspicious gitignore symlink: ${resolved}`)
        return false
      }
      const fd = fs.openSync(resolved, "r")
      try {
        const stats = fs.fstatSync(fd)
        if (!stats.isFile()) {
          warn(`Skipping non-file .gitignore: ${resolved}`)
          return false
        }
        if (stats.size > MAX_GITIGNORE_SIZE) {
          warn(`Skipping oversized .gitignore: ${resolved}`)
          return false
        }
        const content = fs.readFileSync(fd, "utf-8")
        return content.includes(CONFIG_PATH) || content.includes(".appwarden/")
      } finally {
        fs.closeSync(fd)
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        // .gitignore doesn't exist in this directory; continue searching up
      } else {
        return false
      }
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return false
}

async function main() {
  if (process.env.APPWARDEN_SKIP_POSTBUILD === "1") {
    print("APPWARDEN_SKIP_POSTBUILD=1 detected, skipping.")
    process.exit(0)
  }
  const args = parseArgs()
  const cwd = args.cwd
  const framework = detectFramework(cwd, args.framework)
  if (!framework) {
    warn("Could not detect framework. Use --framework=<name> to specify.")
  } else {
    print(`Detected framework: ${framework}`)
  }
  const apiToken = process.env.APPWARDEN_API_TOKEN || null
  const apiHostname = args.staging
    ? "https://staging-api.appwarden.io"
    : "https://api.appwarden.io"
  const fqdn = args.fqdn || process.env.APPWARDEN_FQDN || null
  if (args.staging) {
    print("Using staging API hostname")
  }
  if (apiToken) {
    print(`Using provided Appwarden API token`)
  } else {
    print("APPWARDEN_API_TOKEN not set. Using local headers and defaults only.")
  }
  const localHeaders = extractLocalHeadersConfig(cwd, framework)
  if (localHeaders) {
    print("Found local CSP headers configuration.")
  }
  const remote = await fetchRemoteConfig(apiToken, apiHostname, fqdn)
  if (remote) {
    print("Fetched remote Appwarden configuration.")
  }
  const merged = mergeConfigs(remote, localHeaders)
  if (!merged.lockPageSlug && merged.lockPageSlug !== "") {
    merged.lockPageSlug = ""
  }
  const outDir = path.join(cwd, ".appwarden", "linked")
  const outPath = path.join(outDir, "middleware.json")
  const safeConfig = { ...merged }
  delete safeConfig.appwardenApiToken
  const validation = BuildOutputSchema.safeParse(safeConfig)
  if (!validation.success) {
    warn("Generated config failed validation:", validation.error.message)
    process.exit(1)
  }
  const writeOk = safeWriteFile(
    outPath,
    JSON.stringify(safeConfig, null, 2) + "\n",
    cwd,
  )
  if (writeOk) {
    print(`Wrote merged configuration to ${outPath}`)
  } else {
    warn(`Failed to write merged configuration to ${outPath}`)
    process.exit(1)
  }
  if (!checkGitignore(cwd)) {
    warn(GITIGNORE_WARNING)
  }
}

main().catch((err) => {
  console.error("[appwarden] Fatal error:", err)
  process.exit(1)
})

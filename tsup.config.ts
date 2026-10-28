import { readFileSync } from "fs"
import { defineConfig } from "tsup"

declare let process: {
  env: {
    NODE_ENV?: "production" | "test"
    // Set by the release pipeline so the bundle reports the version being
    // published rather than the one in package.json at build time.
    APPWARDEN_BUILD_VERSION?: string
  }
}

const v = (value: string | number | boolean) => JSON.stringify(value)

const isProd = process.env.NODE_ENV === "production"

// Read package version from package.json
const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"))
// semantic-release determines the next version after the build has already run,
// so the release pipeline passes it in explicitly. Otherwise the bundle would
// report the previous version at runtime (see src/version.ts).
const packageVersion =
  process.env.APPWARDEN_BUILD_VERSION ?? packageJson.version

export default defineConfig({
  format: ["esm"],
  outDir: "build",
  minify: false,
  clean: true,
  dts: true,
  // don't bundle split unless we're in prod
  splitting: isProd,
  external: ["cloudflare:workers"],
  noExternal: isProd ? undefined : [/(.*)/],
  esbuildOptions(options) {
    options.external = [...(options.external ?? []), "cloudflare:workers"]
  },
  entry: {
    index: "src/index.ts",
    vercel: "src/bundles/vercel.ts",
    cloudflare: "src/bundles/cloudflare.ts",
    "cloudflare/astro": "src/bundles/astro-cloudflare.ts",
    "cloudflare/react-router": "src/bundles/react-router-cloudflare.ts",
    "cloudflare/tanstack-start": "src/bundles/tanstack-start-cloudflare.ts",
    "cloudflare/nextjs": "src/bundles/nextjs-cloudflare.ts",
  },
  define: isProd
    ? {
        API_HOSTNAME: v("https://api.appwarden.io"),
        API_PATHNAME: v("/v1/appwarden/status"),
        CACHE_EXPIRY_MS: v(30_000),
        __PACKAGE_VERSION__: v(packageVersion),
      }
    : {
        API_HOSTNAME: v("https://staging-api.appwarden.io"),
        API_PATHNAME: v("/v1/appwarden/status"),
        CACHE_EXPIRY_MS: v(30_000),
        __PACKAGE_VERSION__: v(packageVersion),
      },
})

import { readFileSync } from "fs"
import { defineConfig } from "tsup"

declare let process: {
  env: {
    NODE_ENV?: "production" | "test"
  }
}

const v = (value: string | number | boolean) => JSON.stringify(value)

const isProd = process.env.NODE_ENV === "production"

// Read package version from package.json
const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"))
const packageVersion = packageJson.version

export default defineConfig({
  format: ["esm"],
  outDir: "build",
  minify: false,
  clean: true,
  dts: true,
  // don't bundle split unless we're in prod
  splitting: true,
  external: ["cloudflare:workers"],
  noExternal: true ? undefined : [/(.*)/],
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

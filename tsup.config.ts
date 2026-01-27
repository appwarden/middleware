import { defineConfig } from "tsup"

declare let process: {
  env: {
    NODE_ENV?: "production" | "test"
  }
}

const v = (value: string | number | boolean) => JSON.stringify(value)

const isProd = process.env.NODE_ENV === "production"

export default defineConfig({
  format: ["esm"],
  outDir: "build",
  minify: false,
  clean: true,
  dts: true,
  // don't bundle split unless we're in prod
  splitting: isProd,
  noExternal: isProd ? undefined : [/(.*)/],
  entry: {
    index: "src/index.ts",
    vercel: "src/bundles/vercel.ts",
    cloudflare: "src/bundles/cloudflare.ts",
  },
  define: isProd
    ? {
        DEBUG: v(true),
        API_HOSTNAME: v("https://api.appwarden.io"),
        API_PATHNAME: v("/v1/status/check"),
        CACHE_EXPIRY_MS: v(30_000),
      }
    : {
        DEBUG: v(true),
        API_HOSTNAME: v("https://staging-api.appwarden.io"),
        API_PATHNAME: v("/v1/status/check"),
        CACHE_EXPIRY_MS: v(30_000),
      },
})

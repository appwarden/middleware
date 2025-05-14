import * as cheerio from "cheerio"
import { Miniflare, type MiniflareOptions } from "miniflare"
import { MockAgent } from "undici"
import { Bindings } from "../types"

// Use absolute path to avoid path resolution issues
export const projectPath = process.cwd()

export const validBindings = {
  LOCK_PAGE_SLUG: "/maintenance",
  APPWARDEN_API_TOKEN: "123",
  CSP_MODE: "report-only",
  CSP_DIRECTIVES: `{ "defaultSrc": ["{{nonce}}"] }`,
} as const

export const getBindings = (bindings: Partial<Bindings> = validBindings) =>
  bindings

export const init = (fetchMock: MockAgent, bindings: Record<string, any>) =>
  new Miniflare({
    modules: true,
    scriptPath: `${projectPath}/build/test-cloudflare.js`,
    bindings,
    // Set up the global dispatcher for fetch requests
    globals: {
      // @ts-expect-error - MockAgent types don't include fetch but it works
      fetch: fetchMock.fetch,
    },
  } as MiniflareOptions)

export const getRequest = (mf: Miniflare) =>
  mf.dispatchFetch("https://appwarden.io", {
    headers: { "content-type": "text/html" },
  })

export const getNonce = ($: cheerio.CheerioAPI, el: cheerio.Element) =>
  $(el).attr("nonce")

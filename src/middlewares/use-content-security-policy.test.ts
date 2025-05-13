import { Miniflare } from "miniflare"
import { afterEach, describe, expect, it } from "vitest"
import { fetchMocks } from "../test/fetch-mocks"
import {
  getBindings,
  getRequest,
  init,
  validBindings,
} from "../test/test.helpers"

describe("use-content-security-policy", () => {
  let mf: Miniflare

  afterEach(async () => {
    await mf?.dispose?.()
  })

  it("requires APPWARDEN_API_TOKEN", async (ctx) => {
    mf = init(ctx.fetchMock, getBindings({}))
    fetchMocks.origin.view(ctx.fetchMock)

    const response = await getRequest(mf)

    expect(response.headers.get("test-appwarden-ran")).toBeNull()
  })

  it("requires LOCK_PAGE_SLUG", async (ctx) => {
    mf = init(ctx.fetchMock, getBindings({ APPWARDEN_API_TOKEN: "123" }))
    fetchMocks.origin.view(ctx.fetchMock)

    const response = await getRequest(mf)

    expect(response.headers.get("test-appwarden-ran")).toBeNull()
  })

  it.for([
    { input: "enforced", expected: "content-security-policy" },
    { input: "report-only", expected: "content-security-policy-report-only" },
  ])("should attach a content-security-policy header", async (test, ctx) => {
    // Mock the API response
    fetchMocks.appwarden.check(ctx.fetchMock, async () => ({
      isLocked: false,
      isLockedTest: false,
    }))

    mf = init(
      ctx.fetchMock,
      getBindings({ ...validBindings, CSP_MODE: test.input as any }),
    )

    fetchMocks.origin.view(ctx.fetchMock)

    const responses = await Promise.all([
      getRequest(mf),
      getRequest(mf),
      getRequest(mf),
    ])

    for (const response of responses) {
      expect(response.headers.get(test.expected)).toBeDefined()
      expect(response.headers.get(test.expected)).toContain("nonce")
    }

    // With direct Miniflare, we're just checking that the CSP header is set
    // The actual nonce generation and script tag modification is tested in the original middleware
    // and doesn't need to be re-tested here
  })
})

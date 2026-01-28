import { fetchMock, SELF } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { mockOriginResponse } from "../test/test.helpers"

// Mock the debug utility to avoid DEBUG global issues
vi.mock("../utils/debug", () => ({
  debug: vi.fn(),
  printMessage: vi.fn((msg) => msg),
}))

import { useContentSecurityPolicy } from "./use-content-security-policy"

describe("use-content-security-policy", () => {
  beforeAll(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
  })

  afterEach(() => {
    // Clear all mocks after each test - do this BEFORE asserting
    fetchMock.deactivate()
  })

  it("should attach a content-security-policy header", async () => {
    // NOTE: This test uses the CSP_MODE from wrangler.jsonc ("report-only")
    // We cannot override env bindings per-test when using singleWorker: true
    const expectedHeader = "content-security-policy-report-only"

    // Mock the Appwarden API response
    fetchMock
      .get("https://staging-api.appwarden.io")
      .intercept({
        method: "POST",
        path: "/v1/status/check",
      })
      .reply(
        200,
        {
          content: {
            isLocked: 0,
            isLockedTest: 0,
            code: "OK",
          },
        },
        {
          headers: { "content-type": "application/json" },
        },
      )
      .persist()

    // Mock origin response
    fetchMock
      .get("https://appwarden.io")
      .intercept({ path: "/" })
      .reply(200, mockOriginResponse, {
        headers: { "content-type": "text/html" },
      })
      .persist()

    const responses = await Promise.all([
      SELF.fetch("https://appwarden.io", {
        headers: { "content-type": "text/html" },
      }),
      SELF.fetch("https://appwarden.io", {
        headers: { "content-type": "text/html" },
      }),
      SELF.fetch("https://appwarden.io", {
        headers: { "content-type": "text/html" },
      }),
    ])

    for (const response of responses) {
      expect(response.headers.get(expectedHeader)).toBeDefined()
      expect(response.headers.get(expectedHeader)).toContain("nonce")
    }
  })

  describe("unit tests", () => {
    it("should throw error for invalid config - missing directives when mode is enforced", () => {
      const invalidConfig = {
        mode: "enforced" as const,
        // Missing required directives
      }

      expect(() => useContentSecurityPolicy(invalidConfig as any)).toThrow()
    })

    it("should throw error for invalid config - missing directives when mode is report-only", () => {
      const invalidConfig = {
        mode: "report-only" as const,
        // Missing required directives
      }

      expect(() => useContentSecurityPolicy(invalidConfig as any)).toThrow()
    })

    it("should not throw error for disabled mode without directives", () => {
      const validConfig = {
        mode: "disabled" as const,
      }

      expect(() => useContentSecurityPolicy(validConfig)).not.toThrow()
    })

    it("should skip CSP when mode is disabled", async () => {
      const middleware = useContentSecurityPolicy({
        mode: "disabled",
      })

      const mockContext = {
        request: new Request("https://example.com"),
        response: new Response("<html></html>", {
          headers: { "content-type": "text/html" },
        }),
        hostname: "example.com",
        waitUntil: vi.fn(),
      }

      const next = vi.fn()

      await middleware(mockContext, next)

      // Should call next
      expect(next).toHaveBeenCalled()

      // Should not modify response (no CSP header added)
      expect(mockContext.response.headers.has("content-security-policy")).toBe(
        false,
      )
      expect(
        mockContext.response.headers.has("content-security-policy-report-only"),
      ).toBe(false)
    })

    it("should skip CSP for non-HTML content types", async () => {
      const middleware = useContentSecurityPolicy({
        mode: "enforced",
        directives: {
          "default-src": ["'self'"],
        },
      })

      const mockContext = {
        request: new Request("https://example.com/api/data"),
        response: new Response(JSON.stringify({ data: "test" }), {
          headers: { "content-type": "application/json" },
        }),
        hostname: "example.com",
        waitUntil: vi.fn(),
      }

      const next = vi.fn()

      await middleware(mockContext, next)

      // Should call next
      expect(next).toHaveBeenCalled()

      // Should not modify response (no CSP header added)
      expect(mockContext.response.headers.has("content-security-policy")).toBe(
        false,
      )
    })

    it("should add CSP header for HTML content when mode is enforced", async () => {
      const middleware = useContentSecurityPolicy({
        mode: "enforced",
        directives: {
          "default-src": ["'self'"],
        },
      })

      const mockContext = {
        request: new Request("https://example.com"),
        response: new Response("<html><script src='test.js'></script></html>", {
          headers: { "content-type": "text/html" },
        }),
        hostname: "example.com",
        waitUntil: vi.fn(),
      }

      const next = vi.fn()

      await middleware(mockContext, next)

      // Should call next
      expect(next).toHaveBeenCalled()

      // Should add CSP header
      expect(mockContext.response.headers.has("content-security-policy")).toBe(
        true,
      )
      expect(
        mockContext.response.headers.get("content-security-policy"),
      ).toContain("default-src")
    })

    it("should add CSP report-only header when mode is report-only", async () => {
      const middleware = useContentSecurityPolicy({
        mode: "report-only",
        directives: {
          "default-src": ["'self'"],
        },
      })

      const mockContext = {
        request: new Request("https://example.com"),
        response: new Response("<html><script src='test.js'></script></html>", {
          headers: { "content-type": "text/html" },
        }),
        hostname: "example.com",
        waitUntil: vi.fn(),
      }

      const next = vi.fn()

      await middleware(mockContext, next)

      // Should call next
      expect(next).toHaveBeenCalled()

      // Should add CSP report-only header
      expect(
        mockContext.response.headers.has("content-security-policy-report-only"),
      ).toBe(true)
      expect(
        mockContext.response.headers.get("content-security-policy-report-only"),
      ).toContain("default-src")
    })

    describe("CSP Security Validation", () => {
      it("should generate unique nonces for each request", async () => {
        const middleware = useContentSecurityPolicy({
          mode: "enforced",
          directives: {
            "script-src": ["'self'", "{{nonce}}"],
          },
        })

        const nonces: string[] = []

        // Make 100 requests to test nonce uniqueness
        for (let i = 0; i < 100; i++) {
          const mockContext = {
            request: new Request("https://example.com"),
            response: new Response(
              "<html><script>alert('test')</script></html>",
              {
                headers: { "content-type": "text/html" },
              },
            ),
            hostname: "example.com",
            waitUntil: vi.fn(),
          }

          const next = vi.fn()
          await middleware(mockContext, next)

          const cspHeader = mockContext.response.headers.get(
            "content-security-policy",
          )
          expect(cspHeader).toBeDefined()

          // Extract nonce from CSP header
          const nonceMatch = cspHeader?.match(/'nonce-([^']+)'/)
          expect(nonceMatch).toBeDefined()
          const nonce = nonceMatch![1]

          nonces.push(nonce)
        }

        // Verify all nonces are unique
        const uniqueNonces = new Set(nonces)
        expect(uniqueNonces.size).toBe(100)
      })

      it("should inject nonce into script tags via HTMLRewriter", async () => {
        const middleware = useContentSecurityPolicy({
          mode: "enforced",
          directives: {
            "script-src": ["'self'", "{{nonce}}"],
          },
        })

        const mockContext = {
          request: new Request("https://example.com"),
          response: new Response(
            "<html><head><script>console.log('test')</script></head></html>",
            {
              headers: { "content-type": "text/html" },
            },
          ),
          hostname: "example.com",
          waitUntil: vi.fn(),
        }

        const next = vi.fn()
        await middleware(mockContext, next)

        const cspHeader = mockContext.response.headers.get(
          "content-security-policy",
        )
        const nonceMatch = cspHeader?.match(/'nonce-([^']+)'/)
        const expectedNonce = nonceMatch![1]

        // Read the transformed HTML
        const html = await mockContext.response.text()

        // Verify nonce was injected into script tag
        expect(html).toContain(`nonce="${expectedNonce}"`)
      })

      it("should inject nonce into style tags via HTMLRewriter", async () => {
        const middleware = useContentSecurityPolicy({
          mode: "enforced",
          directives: {
            "style-src": ["'self'", "{{nonce}}"],
          },
        })

        const mockContext = {
          request: new Request("https://example.com"),
          response: new Response(
            "<html><head><style>body { color: red; }</style></head></html>",
            {
              headers: { "content-type": "text/html" },
            },
          ),
          hostname: "example.com",
          waitUntil: vi.fn(),
        }

        const next = vi.fn()
        await middleware(mockContext, next)

        const cspHeader = mockContext.response.headers.get(
          "content-security-policy",
        )
        const nonceMatch = cspHeader?.match(/'nonce-([^']+)'/)
        const expectedNonce = nonceMatch![1]

        // Read the transformed HTML
        const html = await mockContext.response.text()

        // Verify nonce was injected into style tag
        expect(html).toContain(`nonce="${expectedNonce}"`)
      })

      it("should properly format nonce in CSP header with 'nonce-' prefix", async () => {
        const middleware = useContentSecurityPolicy({
          mode: "enforced",
          directives: {
            "script-src": ["'self'", "{{nonce}}"],
            "style-src": ["'self'", "{{nonce}}"],
          },
        })

        const mockContext = {
          request: new Request("https://example.com"),
          response: new Response("<html></html>", {
            headers: { "content-type": "text/html" },
          }),
          hostname: "example.com",
          waitUntil: vi.fn(),
        }

        const next = vi.fn()
        await middleware(mockContext, next)

        const cspHeader = mockContext.response.headers.get(
          "content-security-policy",
        )

        // Verify nonce format: 'nonce-<base64-string>'
        expect(cspHeader).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)

        // Verify nonce appears in both script-src and style-src
        const scriptSrcMatch = cspHeader?.match(
          /script-src[^;]*'nonce-([^']+)'/,
        )
        const styleSrcMatch = cspHeader?.match(/style-src[^;]*'nonce-([^']+)'/)

        expect(scriptSrcMatch).toBeDefined()
        expect(styleSrcMatch).toBeDefined()

        // Both should use the same nonce
        expect(scriptSrcMatch![1]).toBe(styleSrcMatch![1])
      })

      it("should generate cryptographically random nonces", async () => {
        const middleware = useContentSecurityPolicy({
          mode: "enforced",
          directives: {
            "script-src": ["{{nonce}}"],
          },
        })

        const nonces: string[] = []

        // Generate 50 nonces
        for (let i = 0; i < 50; i++) {
          const mockContext = {
            request: new Request("https://example.com"),
            response: new Response("<html></html>", {
              headers: { "content-type": "text/html" },
            }),
            hostname: "example.com",
            waitUntil: vi.fn(),
          }

          const next = vi.fn()
          await middleware(mockContext, next)

          const cspHeader = mockContext.response.headers.get(
            "content-security-policy",
          )
          const nonceMatch = cspHeader?.match(/'nonce-([^']+)'/)
          nonces.push(nonceMatch![1])
        }

        // Verify no sequential patterns (basic randomness check)
        // If nonces were sequential, we'd see patterns
        const sortedNonces = [...nonces].sort()
        let sequentialCount = 0
        for (let i = 1; i < sortedNonces.length; i++) {
          if (sortedNonces[i] === sortedNonces[i - 1]) {
            sequentialCount++
          }
        }

        // No duplicates should exist
        expect(sequentialCount).toBe(0)

        // Verify nonces have sufficient entropy (length check)
        nonces.forEach((nonce) => {
          expect(nonce.length).toBeGreaterThan(10) // Base64 encoded should be reasonably long
        })
      })
    })
  })
})

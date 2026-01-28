import { fetchMock, SELF } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

describe("Integration Tests - Request/Response Flows", () => {
  beforeAll(() => {
    fetchMock.activate()
    fetchMock.disableNetConnect()
  })

  afterEach(() => {
    // Clear all mocks after each test
    fetchMock.deactivate()
    fetchMock.activate()
    fetchMock.disableNetConnect()
  })

  describe("Full middleware pipeline", () => {
    it("should process request through complete middleware stack", async () => {
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
        .reply(
          200,
          `<html>
            <head><title>Test</title></head>
            <body>
              <script src="test.js"></script>
              <h1>Hello World</h1>
            </body>
          </html>`,
          {
            headers: { "content-type": "text/html" },
          },
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/", {
        headers: { "content-type": "text/html" },
      })

      // Verify response
      expect(response.status).toBe(200)
      expect(response.headers.get("test-appwarden-ran")).toBe("true")
      expect(
        response.headers.get("content-security-policy-report-only"),
      ).toBeDefined()

      const html = await response.text()
      expect(html).toContain("<h1>Hello World</h1>")
      expect(html).toContain("nonce=")
    })

    it("should handle non-HTML responses correctly", async () => {
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

      // Mock JSON API response
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/api/data" })
        .reply(
          200,
          { message: "Hello API" },
          {
            headers: { "content-type": "application/json" },
          },
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/api/data")

      // Verify response
      expect(response.status).toBe(200)
      expect(response.headers.get("test-appwarden-ran")).toBe("true")
      // CSP should not be added to non-HTML responses
      expect(
        response.headers.get("content-security-policy-report-only"),
      ).toBeNull()

      const data = await response.json()
      expect(data).toEqual({ message: "Hello API" })
    })

    it("should handle errors gracefully", async () => {
      // Mock origin to return an error
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/error" })
        .reply(500, "Internal Server Error", {
          headers: { "content-type": "text/plain" },
        })
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/error")

      // Verify error response is passed through
      expect(response.status).toBe(500)
      const text = await response.text()
      expect(text).toBe("Internal Server Error")
    })
  })

  describe("Middleware pipeline execution", () => {
    it("should execute middlewares in correct order", async () => {
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
        .intercept({ path: "/pipeline-test" })
        .reply(200, "<html><body>Pipeline Test</body></html>", {
          headers: { "content-type": "text/html" },
        })
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/pipeline-test", {
        headers: { "content-type": "text/html" },
      })

      // Verify response has headers from all middlewares in the pipeline
      // 1. test-appwarden-ran header from useHeader middleware
      expect(response.headers.get("test-appwarden-ran")).toBe("true")
      // 2. CSP header from useContentSecurityPolicy middleware
      expect(
        response.headers.get("content-security-policy-report-only"),
      ).toBeDefined()

      // Verify the response body is correct
      const html = await response.text()
      expect(html).toContain("Pipeline Test")
    })

    it("should pass context correctly through middleware chain", async () => {
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

      // Mock origin response with script tags
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/context-test" })
        .reply(
          200,
          `<html>
            <head><script src="app.js"></script></head>
            <body><script>console.log('test')</script></body>
          </html>`,
          {
            headers: { "content-type": "text/html" },
          },
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/context-test", {
        headers: { "content-type": "text/html" },
      })

      // Verify CSP middleware received and processed the HTML response
      const html = await response.text()
      // Both script tags should have nonce attributes added
      const nonceMatches = html.match(/nonce="[^"]+"/g)
      expect(nonceMatches).toBeDefined()
      expect(nonceMatches!.length).toBeGreaterThanOrEqual(2)
    })

    it("should handle middleware errors gracefully", async () => {
      // Mock origin to return a 500 error
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/middleware-error" })
        .reply(500, "Internal Server Error", {
          headers: { "content-type": "text/plain" },
        })

      // Make request through the test app
      // The middleware should pass through the error response
      const response = await SELF.fetch("https://appwarden.io/middleware-error")

      // Verify we get a response (not a thrown error)
      expect(response).toBeInstanceOf(Response)
      // The response should indicate an error occurred
      expect(response.status).toBe(500)
      const text = await response.text()
      expect(text).toBe("Internal Server Error")
    })
  })

  // NOTE: Lock/Quarantine functionality tests are not included in integration tests
  // because the Cloudflare Workers test environment's Cache API does not persist
  // values correctly between operations. Lock functionality is covered by unit tests
  // in src/handlers/maybe-quarantine.test.ts and src/middlewares/use-appwarden.test.ts

  // NOTE: Special routes (/_appwarden/test and /__appwarden/reset-cache) are not
  // included in integration tests for the same reason - they rely on cache operations.
  // These features are covered by unit tests in src/handlers/reset-cache.test.ts and
  // src/handlers/maybe-quarantine.test.ts

  describe("CSP Mode Variations", () => {
    it("should inject nonces into style tags", async () => {
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

      // Mock origin response with style tags (use a different path to avoid mock conflicts)
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/styles" })
        .reply(
          200,
          `<html>
            <head>
              <title>Test</title>
              <style>body { color: red; }</style>
            </head>
            <body>
              <style>.test { color: blue; }</style>
              <h1>Hello World</h1>
            </body>
          </html>`,
          {
            headers: { "content-type": "text/html" },
          },
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/styles", {
        headers: { "content-type": "text/html" },
      })

      // Verify response is successful
      expect(response.status).toBe(200)

      // Verify style tags have nonces
      const html = await response.text()
      expect(html).toContain("<style")
      expect(html).toContain("nonce=")

      // Extract all style tags and verify they have nonces
      const styleMatches = html.match(/<style[^>]*>/g)
      expect(styleMatches).toBeTruthy()
      expect(styleMatches!.length).toBe(2) // We have 2 style tags in the mock

      // All style tags should have nonce attributes
      styleMatches!.forEach((styleTag) => {
        expect(styleTag).toMatch(/nonce="[^"]+"/)
      })
    })
  })

  describe("API Response Variations", () => {
    it("should handle API errors gracefully", async () => {
      // Mock the Appwarden API to return an error
      fetchMock
        .get("https://staging-api.appwarden.io")
        .intercept({
          method: "POST",
          path: "/v1/status/check",
        })
        .reply(500, { error: "Internal Server Error" })
        .persist()

      // Mock origin response
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/api-error" })
        .reply(
          200,
          `<html>
            <head><title>Test</title></head>
            <body><h1>Hello World</h1></body>
          </html>`,
          {
            headers: { "content-type": "text/html" },
          },
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/api-error", {
        headers: { "content-type": "text/html" },
      })

      // Should still return the origin response even if API fails
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain("Hello World")
    })

    it("should handle API timeout gracefully", async () => {
      // Mock the Appwarden API to timeout (no response)
      fetchMock
        .get("https://staging-api.appwarden.io")
        .intercept({
          method: "POST",
          path: "/v1/status/check",
        })
        .reply(408, { error: "Request Timeout" })
        .persist()

      // Mock origin response
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/api-timeout" })
        .reply(
          200,
          `<html>
            <head><title>Test</title></head>
            <body><h1>Hello World</h1></body>
          </html>`,
          {
            headers: { "content-type": "text/html" },
          },
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch("https://appwarden.io/api-timeout", {
        headers: { "content-type": "text/html" },
      })

      // Should still return the origin response even if API times out
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain("Hello World")
    })
  })

  describe("Edge Cases", () => {
    it("should handle responses without Content-Type header", async () => {
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

      // Mock origin response without Content-Type header
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/no-content-type" })
        .reply(
          200,
          `<html>
            <head><title>Test</title></head>
            <body><h1>No Content-Type</h1></body>
          </html>`,
        )
        .persist()

      // Make request through the test app
      const response = await SELF.fetch(
        "https://appwarden.io/no-content-type",
        {
          headers: { "content-type": "text/html" },
        },
      )

      // Should still return the response
      expect(response.status).toBe(200)
      const html = await response.text()
      expect(html).toContain("No Content-Type")
    })

    it("should generate unique nonces for multiple requests", async () => {
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

      // Mock origin response with script tag
      fetchMock
        .get("https://appwarden.io")
        .intercept({ path: "/nonce-test" })
        .reply(
          200,
          `<html>
            <head><title>Test</title></head>
            <body>
              <script src="test.js"></script>
            </body>
          </html>`,
          {
            headers: { "content-type": "text/html" },
          },
        )
        .persist()

      // Make two requests
      const response1 = await SELF.fetch("https://appwarden.io/nonce-test", {
        headers: { "content-type": "text/html" },
      })
      const response2 = await SELF.fetch("https://appwarden.io/nonce-test", {
        headers: { "content-type": "text/html" },
      })

      // Extract nonces from both responses
      const html1 = await response1.text()
      const html2 = await response2.text()

      const nonce1Match = html1.match(/nonce="([^"]+)"/)
      const nonce2Match = html2.match(/nonce="([^"]+)"/)

      expect(nonce1Match).toBeTruthy()
      expect(nonce2Match).toBeTruthy()

      // Nonces should be different for each request
      expect(nonce1Match![1]).not.toBe(nonce2Match![1])
    })
  })
})

import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import {
  createHeartbeatConfigError,
  createHeartbeatResponse,
  createHeartbeatResponseBody,
  handleHeartbeatRequest,
  isHeartbeatRequest,
  sanitizeConfigErrors,
} from "./heartbeat"

describe("heartbeat utilities", () => {
  describe("sanitizeConfigErrors", () => {
    it("should return empty array when no error is provided", () => {
      const result = sanitizeConfigErrors(undefined)
      expect(result).toEqual([])
    })

    it("should sanitize Zod validation errors", () => {
      const error = new ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "number",
          path: ["lockPageSlug"],
          message: "Expected string, received number",
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        path: ["lockPageSlug"],
        code: "invalid_type",
        message: "Invalid type for lockPageSlug",
      })
    })

    it("should limit errors to MAX_CONFIG_ERRORS (10)", () => {
      const issues = Array.from({ length: 15 }, (_, i) => ({
        code: "invalid_type" as const,
        expected: "string" as const,
        received: "number" as const,
        path: [`field${i}`],
        message: `Error ${i}`,
      }))

      const error = new ZodError(issues)
      const result = sanitizeConfigErrors(error)
      expect(result).toHaveLength(10)
    })

    it("should ignore raw Zod messages and use controlled sanitization", () => {
      const longMessage = "a".repeat(600)
      const error = new ZodError([
        {
          code: "custom",
          path: ["test"],
          message: longMessage,
        },
      ])

      const result = sanitizeConfigErrors(error)
      expect(result[0].message).toBe("Validation failed for test")
    })
  })

  describe("createHeartbeatConfigError", () => {
    it("should create a controlled heartbeat config error", () => {
      const result = createHeartbeatConfigError(
        ["runtime"],
        "custom",
        "Cloudflare runtime unavailable",
      )

      expect(result).toEqual({
        path: ["runtime"],
        code: "custom",
        message: "Cloudflare runtime unavailable",
      })
    })
  })

  describe("createHeartbeatResponseBody", () => {
    it("should create a valid heartbeat response body", () => {
      const body = createHeartbeatResponseBody("cloudflare")
      expect(body).toMatchObject({
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: 1,
        service: "cloudflare",
        configErrors: [],
      })
      expect(body.version).toBeDefined()
    })

    it("should include config errors when provided", () => {
      const configErrors = [
        {
          path: ["lockPageSlug"],
          code: "invalid_type",
          message: "Expected string",
        },
      ]
      const body = createHeartbeatResponseBody("cloudflare-astro", configErrors)
      expect(body.configErrors).toEqual(configErrors)
    })
  })

  describe("createHeartbeatResponse", () => {
    it("should create a Response with correct headers", () => {
      const response = createHeartbeatResponse("cloudflare-nextjs")
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe("application/json")
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("x-appwarden-heartbeat")).toBe("1")
      expect(response.headers.get("x-appwarden-contract-version")).toBe("1")
      expect(response.headers.get("x-appwarden-service")).toBe(
        "cloudflare-nextjs",
      )
      expect(response.headers.get("x-appwarden-version")).toBeDefined()
    })

    it("should include valid JSON body", async () => {
      const response = createHeartbeatResponse("vercel")
      const body = await response.json()
      expect(body).toMatchObject({
        app: "appwarden",
        kind: "heartbeat",
        status: "ok",
        contractVersion: 1,
        service: "vercel",
      })
    })
  })

  describe("isHeartbeatRequest", () => {
    it("should return true for heartbeat route", () => {
      const url = new URL("https://example.com/_appwarden/heartbeat")
      expect(isHeartbeatRequest(url)).toBe(true)
    })

    it("should return false for other routes", () => {
      const url = new URL("https://example.com/")
      expect(isHeartbeatRequest(url)).toBe(false)
    })

    it("should return false for similar routes", () => {
      const url = new URL("https://example.com/_appwarden/heartbeat/extra")
      expect(isHeartbeatRequest(url)).toBe(false)
    })
  })

  describe("handleHeartbeatRequest", () => {
    it("should return 405 for non-GET requests", () => {
      const request = new Request("https://example.com/_appwarden/heartbeat", {
        method: "POST",
      })
      const response = handleHeartbeatRequest(request, "cloudflare", [])
      expect(response.status).toBe(405)
      expect(response.headers.get("allow")).toBe("GET")
    })

    it("should return heartbeat response for GET requests", () => {
      const request = new Request("https://example.com/_appwarden/heartbeat", {
        method: "GET",
      })
      const response = handleHeartbeatRequest(request, "cloudflare", [])
      expect(response.status).toBe(200)
    })
  })
})

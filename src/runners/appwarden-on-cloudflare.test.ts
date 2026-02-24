import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import { ConfigFnInputSchema } from "../schemas"
import { Bindings, MiddlewareContext } from "../types"
import { usePipeline } from "../utils"
import { insertErrorLogs } from "../utils/cloudflare"
import { appwardenOnCloudflare } from "./appwarden-on-cloudflare"

// Mock the ExportedHandlerFetchHandler type to avoid importing from Cloudflare
type MockRequest = Request
type MockExecutionContext = {
  passThroughOnException: () => void
  waitUntil: (promise: Promise<any>) => void
}

// Mock dependencies
vi.mock("../middlewares", () => ({
  useAppwarden: vi.fn(() => async (_ctx: any, next: any) => {
    await next()
  }),
  useContentSecurityPolicy: vi.fn(() => async (_ctx: any, next: any) => {
    await next()
  }),
}))

vi.mock("../middlewares/use-fetch-origin", () => ({
  useFetchOrigin: vi.fn(() => async (ctx: any, next: any) => {
    ctx.response = new Response("Mocked response")
    await next()
  }),
}))

// Mock SchemaErrorKey and other utils exports
vi.mock("../utils", () => ({
  usePipeline: vi.fn(() => ({
    execute: vi.fn(),
  })),
  SchemaErrorKey: {
    DirectivesRequired: "DirectivesRequired",
    DirectivesBadParse: "DirectivesBadParse",
  },
  getErrors: vi.fn(() => ["Error message"]),
}))

vi.mock("../utils/cloudflare", () => ({
  insertErrorLogs: vi.fn(() => new Response("Error logs")),
}))

describe("appwardenOnCloudflare", () => {
  let mockRequest: MockRequest
  let mockEnv: Bindings
  let mockCtx: MockExecutionContext
  let mockInputFn: any
  let mockPipelineExecute: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup test data
    mockRequest = new Request("https://example.com")
    mockEnv = {
      DEBUG: true,
      LOCK_PAGE_SLUG: "/maintenance",
      CSP_MODE: "report-only",
      CSP_DIRECTIVES: "{}",
      APPWARDEN_API_TOKEN: "test-token",
    }
    mockCtx = {
      passThroughOnException: vi.fn(),
      waitUntil: vi.fn(),
    }

    // Mock valid input function
    mockInputFn = vi.fn((_context) => ({
      debug: true,
      lockPageSlug: "/maintenance",
      appwardenApiToken: "test-token",
      middleware: {
        before: [
          async (_ctx: any, next: any) => {
            await next()
          },
        ],
      },
    }))

    // Mock pipeline execute
    mockPipelineExecute = vi.fn()
    ;(usePipeline as any).mockReturnValue({
      execute: mockPipelineExecute,
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("should call passThroughOnException", async () => {
    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)
    expect(mockCtx.passThroughOnException).toHaveBeenCalled()
  })

  it("should create a middleware context with the correct properties", async () => {
    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)

    // Verify that usePipeline.execute was called with a context that has the expected properties
    const executeCall = mockPipelineExecute.mock.calls[0][0]
    expect(executeCall).toHaveProperty("request", mockRequest)
    expect(executeCall).toHaveProperty("hostname", "example.com")
    expect(executeCall).toHaveProperty("response")
    expect(executeCall).toHaveProperty("waitUntil")
  })

  it("should return error logs when input validation fails", async () => {
    // Mock ConfigFnInputSchema.safeParse to return failure
    const mockSafeParse = vi.spyOn(ConfigFnInputSchema, "safeParse")
    mockSafeParse.mockReturnValueOnce({
      success: false,
      error: new ZodError([]),
    })

    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    const result = await handler(mockRequest, mockEnv, mockCtx)

    expect(insertErrorLogs).toHaveBeenCalled()
    expect(result).toBeInstanceOf(Response)
    expect(await result.text()).toBe("Error logs")

    mockSafeParse.mockRestore()
  })

  it("should execute the middleware pipeline with the correct middlewares", async () => {
    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)

    // Verify usePipeline was called with the correct middlewares
    expect(usePipeline).toHaveBeenCalled()
    expect(mockPipelineExecute).toHaveBeenCalled()
  })

  it("should handle ZodError during execution", async () => {
    // Make pipeline.execute throw a ZodError
    mockPipelineExecute.mockRejectedValueOnce(new ZodError([]))

    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    const result = await handler(mockRequest, mockEnv, mockCtx)

    expect(insertErrorLogs).toHaveBeenCalled()
    expect(result).toBeInstanceOf(Response)
    expect(await result.text()).toBe("Error logs")
  })

  it("should rethrow non-ZodError errors", async () => {
    // Make pipeline.execute throw a non-ZodError
    const testError = new Error("Test error")
    mockPipelineExecute.mockRejectedValueOnce(testError)

    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    await expect(handler(mockRequest, mockEnv, mockCtx)).rejects.toThrow(
      testError,
    )
  })

  it("should return the context response after successful execution", async () => {
    // Mock successful pipeline execution
    mockPipelineExecute.mockImplementationOnce(
      async (context: MiddlewareContext) => {
        context.response = new Response("Success response")
      },
    )

    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    const result = await handler(mockRequest, mockEnv, mockCtx)

    expect(result).toBeInstanceOf(Response)
    expect(await result.text()).toBe("Success response")
  })

  it("should pass the correct input to the middleware pipeline", async () => {
    // Type assertion to make TypeScript happy
    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)

    // Verify that mockInputFn was called with the correct context
    expect(mockInputFn).toHaveBeenCalledWith({
      env: mockEnv,
      ctx: mockCtx,
      cf: {},
    })
  })

  it("should include CSP middleware when multidomainConfig has CSP for the request hostname", async () => {
    mockInputFn.mockReturnValueOnce({
      debug: true,
      appwardenApiToken: "test-token",
      multidomainConfig: {
        "example.com": {
          lockPageSlug: "/maintenance-example",
          contentSecurityPolicy: {
            mode: "enforced",
            directives: {
              "default-src": ["'self'"],
            },
          },
        },
      },
    })

    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)

    // Verify that usePipeline was called with 3 middlewares (useAppwarden, useFetchOrigin, useContentSecurityPolicy)
    const usePipelineArgs = (usePipeline as any).mock.calls[0]
    expect(usePipelineArgs).toHaveLength(3)
  })

  it("should not include CSP middleware when multidomainConfig does not have config for request hostname", async () => {
    // Change request hostname so it does not match any multidomainConfig key
    mockRequest = new Request("https://other-domain.com")

    mockInputFn.mockReturnValueOnce({
      debug: true,
      appwardenApiToken: "test-token",
      multidomainConfig: {
        "example.com": {
          lockPageSlug: "/maintenance-example",
          contentSecurityPolicy: {
            mode: "enforced",
            directives: {
              "default-src": ["'self'"],
            },
          },
        },
      },
    })

    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)

    const usePipelineArgs = (usePipeline as any).mock.calls[0]
    expect(usePipelineArgs).toHaveLength(2)
  })

  it("should not include CSP middleware when multidomainConfig entry for hostname lacks CSP config", async () => {
    mockInputFn.mockReturnValueOnce({
      debug: true,
      appwardenApiToken: "test-token",
      multidomainConfig: {
        "example.com": {
          lockPageSlug: "/maintenance-example",
          // No contentSecurityPolicy configured for this hostname
        },
      },
    })

    const handler = appwardenOnCloudflare(mockInputFn) as any
    await handler(mockRequest, mockEnv, mockCtx)

    const usePipelineArgs = (usePipeline as any).mock.calls[0]
    expect(usePipelineArgs).toHaveLength(2)
  })
})

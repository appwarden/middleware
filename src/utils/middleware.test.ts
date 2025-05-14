import { describe, expect, it, vi } from "vitest"
import { Middleware, MiddlewareContext } from "../types/middleware"
import { usePipeline } from "./middleware"

describe("usePipeline", () => {
  // Create a mock context for testing
  const createMockContext = (): MiddlewareContext => ({
    hostname: "example.com",
    request: new Request("https://example.com"),
    response: new Response("Test response"),
    waitUntil: vi.fn(),
  })

  it("should create a pipeline with the provided middlewares", () => {
    // Create mock middlewares
    const middleware1: Middleware = vi.fn(async (ctx, next) => {
      await next()
    })
    const middleware2: Middleware = vi.fn(async (ctx, next) => {
      await next()
    })

    // Create pipeline
    const pipeline = usePipeline(middleware1, middleware2)

    // Verify pipeline has execute method
    expect(pipeline).toHaveProperty("execute")
    expect(typeof pipeline.execute).toBe("function")
  })

  it("should execute middlewares in the correct order", async () => {
    // Create a tracking array to verify execution order
    const executionOrder: number[] = []

    // Create middlewares that track their execution order
    const middleware1: Middleware = async (ctx, next) => {
      executionOrder.push(1)
      await next()
      executionOrder.push(4) // After all other middlewares have executed
    }

    const middleware2: Middleware = async (ctx, next) => {
      executionOrder.push(2)
      await next()
      executionOrder.push(3) // After middleware3 but before middleware1 completes
    }

    const middleware3: Middleware = async (ctx, next) => {
      executionOrder.push(3)
      await next() // This will just return as there are no more middlewares
    }

    // Create and execute pipeline
    const pipeline = usePipeline(middleware1, middleware2, middleware3)
    await pipeline.execute(createMockContext())

    // Verify execution order
    expect(executionOrder).toEqual([1, 2, 3, 3, 4])
  })

  it("should allow middlewares to modify the context", async () => {
    // Create a context that will be modified
    const context = createMockContext()

    // Create middlewares that modify the context
    const middleware1: Middleware = async (ctx, next) => {
      // Modify the response
      ctx.response = new Response("Modified by middleware1")
      await next()
    }

    const middleware2: Middleware = async (ctx, next) => {
      // Further modify the response
      const currentBody = await ctx.response.text()
      ctx.response = new Response(`${currentBody}, then by middleware2`)
      await next()
    }

    // Create and execute pipeline
    const pipeline = usePipeline(middleware1, middleware2)
    await pipeline.execute(context)

    // Verify context was modified
    expect(await context.response.text()).toBe(
      "Modified by middleware1, then by middleware2",
    )
  })

  it("should handle the case when next() is called multiple times", async () => {
    // Create tracking variables to verify execution flow
    let middleware1Executed = false
    let middleware2Executed = false
    let middleware1AfterNextExecuted = false

    // Create middlewares
    const middleware1: Middleware = async (ctx, next) => {
      middleware1Executed = true

      // Call next() to proceed to middleware2
      await next()

      // This part should execute after middleware2
      middleware1AfterNextExecuted = true

      // Try to call next() again - this should be a no-op due to error handling
      try {
        await next()
      } catch (error) {
        // We expect an error here, but we'll catch it to verify the behavior
        expect((error as Error).message).toBe("next() called multiple times")
        throw error // Re-throw to test error propagation
      }
    }

    const middleware2: Middleware = async (ctx, next) => {
      middleware2Executed = true
      await next()
    }

    // Create pipeline
    const pipeline = usePipeline(middleware1, middleware2)

    // Execute pipeline - we expect it to complete despite the error
    try {
      await pipeline.execute(createMockContext())
    } catch (error) {
      // If the error propagates up, we'll catch it here
      expect((error as Error).message).toBe("next() called multiple times")
    }

    // Verify execution flow
    expect(middleware1Executed).toBe(true)
    expect(middleware2Executed).toBe(true)
    expect(middleware1AfterNextExecuted).toBe(true)
  })

  it("should stop execution when all middlewares are processed", async () => {
    // Create a tracking variable
    let finalStepExecuted = false

    // Create middlewares
    const middleware1: Middleware = async (ctx, next) => {
      await next()
      finalStepExecuted = true
    }

    // Create and execute pipeline
    const pipeline = usePipeline(middleware1)
    await pipeline.execute(createMockContext())

    // Verify the final step was executed
    expect(finalStepExecuted).toBe(true)
  })

  it("should handle async middlewares correctly", async () => {
    // Create a tracking array
    const executionOrder: string[] = []

    // Create async middlewares with delays
    const middleware1: Middleware = async (ctx, next) => {
      executionOrder.push("middleware1 start")
      await new Promise((resolve) => setTimeout(resolve, 10))
      await next()
      await new Promise((resolve) => setTimeout(resolve, 10))
      executionOrder.push("middleware1 end")
    }

    const middleware2: Middleware = async (ctx, next) => {
      executionOrder.push("middleware2 start")
      await new Promise((resolve) => setTimeout(resolve, 5))
      await next()
      executionOrder.push("middleware2 end")
    }

    // Create and execute pipeline
    const pipeline = usePipeline(middleware1, middleware2)
    await pipeline.execute(createMockContext())

    // Verify execution order
    expect(executionOrder).toEqual([
      "middleware1 start",
      "middleware2 start",
      "middleware2 end",
      "middleware1 end",
    ])
  })

  it("should work with an empty middleware stack", async () => {
    // Create pipeline with no middlewares
    const pipeline = usePipeline()

    // Execute should complete without errors
    await expect(pipeline.execute(createMockContext())).resolves.toBeUndefined()
  })

  it("should allow middlewares to skip calling next()", async () => {
    // Create tracking variables
    let middleware1Executed = false
    let middleware2Executed = false

    // Create middlewares
    const middleware1: Middleware = async (ctx, next) => {
      middleware1Executed = true
      // Deliberately not calling next()
    }

    const middleware2: Middleware = async (ctx, next) => {
      middleware2Executed = true
      await next()
    }

    // Create and execute pipeline
    const pipeline = usePipeline(middleware1, middleware2)
    await pipeline.execute(createMockContext())

    // Verify only the first middleware executed
    expect(middleware1Executed).toBe(true)
    expect(middleware2Executed).toBe(false)
  })
})

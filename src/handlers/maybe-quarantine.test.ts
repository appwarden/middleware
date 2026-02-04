import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkLockStatus } from "../core"
import { CloudflareProviderContext } from "../types"
import { maybeQuarantine } from "./maybe-quarantine"

// Mock the core module
vi.mock("../core", () => ({
  checkLockStatus: vi.fn(),
}))

describe("maybeQuarantine", () => {
  let mockContext: CloudflareProviderContext
  let mockOptions: { onLocked: () => Promise<void> }
  let onLockedSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup test data
    onLockedSpy = vi.fn(() => {})
    mockOptions = {
      onLocked: vi.fn().mockImplementation(async () => {
        ;(onLockedSpy as any)()
      }),
    }

    mockContext = {
      request: new Request("https://example.com"),
      requestUrl: new URL("https://example.com"),
      keyName: "appwarden-lock",
      provider: "cloudflare-cache",
      edgeCache: {
        getValue: vi.fn(),
        updateValue: vi.fn(),
        deleteValue: vi.fn(),
      },
      waitUntil: vi.fn(),
      appwardenApiToken: "test-token",
      appwardenApiHostname: "https://api.appwarden.io",
      debug: false,
      lockPageSlug: "/maintenance",
    } as unknown as CloudflareProviderContext
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe("lock status handling", () => {
    it("should call onLocked when checkLockStatus returns isLocked: true", async () => {
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: true,
        isTestLock: false,
      })

      await maybeQuarantine(mockContext, mockOptions)

      expect(mockOptions.onLocked).toHaveBeenCalled()
      expect(onLockedSpy).toHaveBeenCalled()
    })

    it("should call onLocked when checkLockStatus returns isTestLock: true", async () => {
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: true,
        isTestLock: true,
      })

      await maybeQuarantine(mockContext, mockOptions)

      expect(mockOptions.onLocked).toHaveBeenCalled()
      expect(onLockedSpy).toHaveBeenCalled()
    })

    it("should not call onLocked when checkLockStatus returns isLocked: false", async () => {
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      await maybeQuarantine(mockContext, mockOptions)

      expect(mockOptions.onLocked).not.toHaveBeenCalled()
      expect(onLockedSpy).not.toHaveBeenCalled()
    })
  })

  describe("checkLockStatus configuration", () => {
    it("should pass correct config to checkLockStatus", async () => {
      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      await maybeQuarantine(mockContext, mockOptions)

      expect(checkLockStatus).toHaveBeenCalledWith({
        request: mockContext.request,
        appwardenApiToken: "test-token",
        appwardenApiHostname: "https://api.appwarden.io",
        debug: false,
        lockPageSlug: "/maintenance",
        waitUntil: mockContext.waitUntil,
      })
    })

    it("should pass undefined appwardenApiHostname when not provided", async () => {
      // Remove appwardenApiHostname from context
      const contextWithoutHostname = {
        ...mockContext,
        appwardenApiHostname: undefined,
      } as unknown as CloudflareProviderContext

      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      await maybeQuarantine(contextWithoutHostname, mockOptions)

      expect(checkLockStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          appwardenApiHostname: undefined,
        }),
      )
    })

    it("should pass debug: true when context has debug enabled", async () => {
      const contextWithDebug = {
        ...mockContext,
        debug: true,
      } as unknown as CloudflareProviderContext

      vi.mocked(checkLockStatus).mockResolvedValue({
        isLocked: false,
        isTestLock: false,
      })

      await maybeQuarantine(contextWithDebug, mockOptions)

      expect(checkLockStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true,
        }),
      )
    })
  })
})

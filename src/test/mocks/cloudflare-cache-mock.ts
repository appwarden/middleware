/**
 * Mock implementation of Cloudflare Cache API for testing
 *
 * This mock provides a working in-memory cache that respects TTL and Cache-Control headers.
 * It's needed because the native Cache API in vitest-pool-workers is broken.
 *
 * See: https://github.com/cloudflare/workers-sdk/issues/7481
 */

interface CacheEntry {
  response: Response
  expiresAt: number | null
}

export class MockCache implements Cache {
  private storage = new Map<string, CacheEntry>()

  async match(
    request: RequestInfo,
    options?: CacheQueryOptions,
  ): Promise<Response | undefined> {
    const key = this.getKey(request)
    const entry = this.storage.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.storage.delete(key)
      return undefined
    }

    // Clone the response so it can be read multiple times
    return entry.response.clone()
  }

  async put(request: RequestInfo, response: Response): Promise<void> {
    const key = this.getKey(request)

    // Parse TTL from Cache-Control header
    const cacheControl = response.headers.get("cache-control")
    let expiresAt: number | null = null

    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1], 10)
        expiresAt = Date.now() + maxAge * 1000
      }
    }

    // Clone the response to store it
    this.storage.set(key, {
      response: response.clone(),
      expiresAt,
    })
  }

  async delete(
    request: RequestInfo,
    options?: CacheQueryOptions,
  ): Promise<boolean> {
    const key = this.getKey(request)
    return this.storage.delete(key)
  }

  /**
   * Generate a cache key from a Request or URL string
   */
  private getKey(request: RequestInfo): string {
    if (typeof request === "string") {
      return request
    }
    if (request instanceof URL) {
      return request.href
    }
    if (request instanceof Request) {
      return request.url
    }
    throw new Error("Invalid request type")
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.storage.clear()
  }

  /**
   * Get the number of cached entries (useful for testing)
   */
  size(): number {
    return this.storage.size
  }
}

/**
 * Mock CacheStorage that provides named caches
 */
export class MockCacheStorage implements CacheStorage {
  private caches = new Map<string, MockCache>()

  async open(cacheName: string): Promise<Cache> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new MockCache())
    }
    return this.caches.get(cacheName)!
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName)
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys())
  }

  async match(
    request: RequestInfo,
    options?: CacheQueryOptions,
  ): Promise<Response | undefined> {
    // Try all caches in order
    for (const cache of this.caches.values()) {
      const response = await cache.match(request, options)
      if (response) {
        return response
      }
    }
    return undefined
  }

  /**
   * Get the default cache (creates it if it doesn't exist)
   */
  get default(): MockCache {
    if (!this.caches.has("default")) {
      this.caches.set("default", new MockCache())
    }
    return this.caches.get("default")!
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearAll(): void {
    this.caches.clear()
  }
}

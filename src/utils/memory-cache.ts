import { LOCKDOWN_TEST_EXPIRY_MS } from "../constants"
import { LockValueType } from "../schemas"

export class MemoryCache<K, V> {
  private readonly cache = new Map<K, V>()
  private readonly maxSize: number

  constructor(options: { maxSize: number }) {
    this.maxSize = options.maxSize
  }

  get(key: K): V | undefined {
    let item: V | undefined
    if (this.cache.has(key)) {
      // Remove the key and get the value.
      item = this.cache.get(key)
      this.cache.delete(key)
      // Add the key back to the end of the map.
      if (item !== undefined) {
        this.cache.set(key, item)
      }
    }
    return item
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Remove the key from the cache.
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Remove the least recently used item from the cache.
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    // Add the key to the end of the map.
    this.cache.set(key, value)
  }

  getValues(): Map<K, V> {
    return this.cache
  }

  // the default value will be expired here
  static isExpired = (lockValue: LockValueType | undefined) => {
    if (!lockValue) {
      return true
    }

    // @ts-expect-error CACHE_EXPIRY_MS config
    return Date.now() > lockValue.lastCheck + CACHE_EXPIRY_MS
  }

  static isTestExpired = (lockValue: LockValueType | undefined) => {
    if (!lockValue) {
      return true
    }

    return Date.now() > lockValue.isLockedTest + LOCKDOWN_TEST_EXPIRY_MS
  }
}

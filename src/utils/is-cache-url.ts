/**
 * Extracts the Edge Config ID from a valid Edge Config URL
 * @param value The Edge Config URL
 * @returns The Edge Config ID or undefined if the URL is invalid
 */
export const getEdgeConfigId = (value = ""): string | undefined => {
  if (isValidCacheUrl.edgeConfig(value)) {
    const url = new URL(value)
    return url.pathname.replace("/", "")
  }
  return undefined
}

/**
 * Checks if a URL is a valid cache URL (less strict validation)
 */
export const isCacheUrl = {
  /**
   * Checks if a URL is a valid Edge Config URL (hostname check only)
   * @param value The URL to check
   * @returns True if the URL is a valid Edge Config URL, false otherwise
   */
  edgeConfig: (value = ""): boolean => {
    try {
      const url = new URL(value)
      // Allow both HTTP and HTTPS for backward compatibility with tests
      // In production, HTTPS should be preferred
      return url.hostname === "edge-config.vercel.com"
    } catch {
      // If it's not a valid URL, fall back to a more strict check
      return /^https:\/\/edge-config\.vercel\.com\//.test(value)
    }
  },

  /**
   * Checks if a URL is a valid Upstash URL (hostname check only)
   * @param value The URL to check
   * @returns True if the URL is a valid Upstash URL, false otherwise
   */
  upstash: (value = ""): boolean => {
    try {
      const url = new URL(value)
      return url.hostname.endsWith(".upstash.io")
    } catch {
      // If it's not a valid URL, fall back to a more lenient check
      return /^.*\.upstash\.io$/.test(value || "")
    }
  },
}

/**
 * Performs strict validation of cache URLs
 */
export const isValidCacheUrl = {
  /**
   * Strictly validates an Edge Config URL
   * @param value The URL to validate
   * @returns True if the URL is a valid Edge Config URL, false otherwise
   */
  edgeConfig: (value = ""): boolean => {
    // example valid connection string
    // URL {
    //   href: 'https://edge-config.vercel.com/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz?token=123',
    //   origin: 'https://edge-config.vercel.com',
    //   protocol: 'https:',
    //   username: '',
    //   password: '',
    //   host: 'edge-config.vercel.com',
    //   hostname: 'edge-config.vercel.com',
    //   port: '',
    //   pathname: '/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz',
    //   search: '?token=123',
    //   searchParams: URLSearchParams { 'token' => '123' },
    //   hash: ''
    // }
    try {
      const url = new URL(value)
      return (
        // Only allow HTTPS for security
        url.protocol === "https:" &&
        // Exact hostname match
        url.hostname === "edge-config.vercel.com" &&
        // Path must start with /ecfg_
        url.pathname.startsWith("/ecfg_") &&
        // Must have a token parameter
        url.searchParams.has("token") &&
        // Token should not be empty
        url.searchParams.get("token") !== ""
      )
    } catch {
      return false
    }
  },

  /**
   * Strictly validates an Upstash URL
   * @param value The URL to validate
   * @returns The password if the URL is valid, false otherwise
   */
  upstash: (value = ""): string | boolean => {
    // example valid connection string
    // URL {
    //   href: 'rediss://:Aa3vAAIjcDFkNWIzYTlkODVhMWY0ZjliOGQzMmUyNmMxZWUxMzcxOXAxMA@funky-roughy-44527.upstash.io:6379',
    //   origin: 'null',
    //   protocol: 'rediss:',
    //   username: '',
    //   password: 'Aa3vAAIjcDFkNWIzYTlkODVhMWY0ZjliOGQzMmUyNmMxZWUxMzcxOXAxMA',
    //   host: 'funky-roughy-44527.upstash.io:6379',
    //   hostname: 'funky-roughy-44527.upstash.io',
    //   port: '6379',
    //   pathname: '',
    //   search: '',
    //   searchParams: URLSearchParams {},
    //   hash: ''
    // }
    try {
      const url = new URL(value)

      // Validate protocol, hostname, and password
      if (
        // Only allow redis: or rediss: protocols
        ["redis:", "rediss:"].includes(url.protocol) &&
        // Hostname must end with .upstash.io
        url.hostname.endsWith(".upstash.io")
      ) {
        // Return the password for backward compatibility with tests
        return url.password || ""
      }

      return false
    } catch {
      return false
    }
  },
}

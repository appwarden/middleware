export const getEdgeConfigId = (value = "") =>
  isValidCacheUrl.edgeConfig(value)
    ? new URL(value).pathname.replace("/", "")
    : undefined

export const isCacheUrl = {
  edgeConfig: (value = "") => value.includes("edge-config.vercel.com"),
  upstash: (value = "") => value.includes(".upstash.io"),
}

export const isValidCacheUrl = {
  edgeConfig: (value = "") => {
    // example valid connection string
    // URL {
    //   href: 'https://edge-config.vercel.com/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz?token=5010d9a6-04e1-4219-a8b7-f8ecfd3e10d6',
    //   origin: 'https://edge-config.vercel.com',
    //   protocol: 'https:',
    //   username: '',
    //   password: '',
    //   host: 'edge-config.vercel.com',
    //   hostname: 'edge-config.vercel.com',
    //   port: '',
    //   pathname: '/ecfg_yaa9pmoquhmf29cnfott3jhbsfdz',
    //   search: '?token=5010d9a6-04e1-4219-a8b7-f8ecfd3e10d6',
    //   searchParams: URLSearchParams { 'token' => '5010d9a6-04e1-4219-a8b7-f8ecfd3e10d6' },
    //   hash: ''
    // }
    try {
      const url = new URL(value)
      return (
        url.hostname === "edge-config.vercel.com" &&
        url.pathname.startsWith("/ecfg_") &&
        url.searchParams.has("token")
      )
    } catch (error) {
      return false
    }
  },
  upstash: (value = "") => {
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
      return (
        ["redis:", "rediss:"].includes(url.protocol) &&
        url.hostname.endsWith("upstash.io") &&
        url.password
      )
    } catch (error) {
      return false
    }
  },
}

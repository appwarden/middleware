import { appwardenOnCloudflare } from "../runners/appwarden-on-cloudflare"

export { useContentSecurityPolicy } from "../middlewares"
export { getAppwardenConfiguration } from "../runners/appwarden-on-cloudflare"

export const createAppwardenMiddleware = appwardenOnCloudflare

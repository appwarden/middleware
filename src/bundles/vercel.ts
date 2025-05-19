import { appwardenOnVercel } from "../runners/appwarden-on-vercel"

export { BaseNextJsConfigSchema } from "../schemas/vercel"

export const withAppwarden = appwardenOnVercel

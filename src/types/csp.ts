import { z } from "zod"

const stringySchema = z.union([z.array(z.string()), z.string(), z.boolean()])

export const ContentSecurityPolicySchema = z.object({
  "default-src": stringySchema.optional(),
  "script-src": stringySchema.optional(),
  "style-src": stringySchema.optional(),
  "img-src": stringySchema.optional(),
  "connect-src": stringySchema.optional(),
  "font-src": stringySchema.optional(),
  "object-src": stringySchema.optional(),
  "media-src": stringySchema.optional(),
  "frame-src": stringySchema.optional(),
  sandbox: stringySchema.optional(),
  "report-uri": stringySchema.optional(),
  "child-src": stringySchema.optional(),
  "form-action": stringySchema.optional(),
  "frame-ancestors": stringySchema.optional(),
  "plugin-types": stringySchema.optional(),
  "base-uri": stringySchema.optional(),
  "report-to": stringySchema.optional(),
  "worker-src": stringySchema.optional(),
  "manifest-src": stringySchema.optional(),
  "prefetch-src": stringySchema.optional(),
  "navigate-to": stringySchema.optional(),
  "require-sri-for": stringySchema.optional(),
  "block-all-mixed-content": stringySchema.optional(),
  "upgrade-insecure-requests": stringySchema.optional(),
  "trusted-types": stringySchema.optional(),
  "require-trusted-types-for": stringySchema.optional(),
})

export type ContentSecurityPolicyType = z.infer<
  typeof ContentSecurityPolicySchema
>

import { z } from "zod"
import { ContentSecurityPolicyType } from "../types"
import {
  AppwardenConfigErrorKey,
  AppwardenConfigErrorMessages,
} from "../utils/errors"
import {
  AppwardenApiHostnameSchema,
  AppwardenApiTokenSchema,
  BooleanSchema,
  ValidLockPageSlugSchema,
} from "./helpers"
import {
  CSPDirectivesSchema,
  CSPModeSchema,
} from "./use-content-security-policy"

export const DEFAULT_API_LOCK_STATUS = 503
export const DEFAULT_API_LOCK_BODY = '{"error":"Service unavailable"}'

export const PathPatternSchema = z.string().refine(
  (val) => {
    if (!val.startsWith("/")) return false
    const normalized = val.endsWith("/*") ? val.slice(0, -2) : val
    if (normalized.includes("?") || normalized.includes("#")) return false
    try {
      return new URL(`http://example.com${normalized}`).pathname === normalized
    } catch {
      return false
    }
  },
  {
    message: "Path pattern must be a valid absolute path starting with /",
  },
)

export const PathPatternsSchema = z.array(PathPatternSchema)

export const LockPageSlugSchema = ValidLockPageSlugSchema.default(
  "/maintenance",
).transform((val) =>
  val && val.length > 0
    ? val.startsWith("/")
      ? val
      : `/${val}`
    : "/maintenance",
)

export const DebugSchema = BooleanSchema.default(false)

const ParsedCSPDirectivesSchema = CSPDirectivesSchema.refine(
  (val) => {
    try {
      if (typeof val === "string") {
        JSON.parse(val)
      }
      return true
    } catch {
      return false
    }
  },
  {
    message:
      AppwardenConfigErrorMessages[
        AppwardenConfigErrorKey.CspDirectivesBadParse
      ],
    params: {
      appwardenErrorKey: AppwardenConfigErrorKey.CspDirectivesBadParse,
    },
  },
).transform(
  (val) =>
    (typeof val === "string" ? JSON.parse(val) : val) as
      ContentSecurityPolicyType | undefined,
)

const buildNonceFreeDirectivesSchema = (errorKey: AppwardenConfigErrorKey) =>
  ParsedCSPDirectivesSchema.refine(
    (val) => {
      const serialized = JSON.stringify(val)
      return !serialized.includes("{{nonce}}")
    },
    {
      message: AppwardenConfigErrorMessages[errorKey],
      params: {
        appwardenErrorKey: errorKey,
      },
    },
  )

export const NonceFreeCSPDirectivesSchema = buildNonceFreeDirectivesSchema(
  AppwardenConfigErrorKey.VercelNonceUnsupported,
)

export const NextJsNonceFreeCSPDirectivesSchema =
  buildNonceFreeDirectivesSchema(AppwardenConfigErrorKey.NextJsNonceUnsupported)

export const WebsiteMiddlewareConfigSchema = z.object({
  lockPageSlug: LockPageSlugSchema,
  cspMode: CSPModeSchema.optional(),
  cspDirectives: ParsedCSPDirectivesSchema.optional(),
})

export const WebsiteMiddlewareConfigWithoutNonceSchema = z.object({
  lockPageSlug: LockPageSlugSchema,
  cspMode: CSPModeSchema.optional(),
  cspDirectives: NonceFreeCSPDirectivesSchema.optional(),
})

export const WebsiteMiddlewareConfigNextJsSchema = z.object({
  lockPageSlug: LockPageSlugSchema,
  cspMode: CSPModeSchema.optional(),
  cspDirectives: NextJsNonceFreeCSPDirectivesSchema.optional(),
})

export const ApiResponseHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
})

export const ApiResponseSchema = z.object({
  status: z.number().default(DEFAULT_API_LOCK_STATUS),
  body: z.string().default(DEFAULT_API_LOCK_BODY),
  headers: z.array(ApiResponseHeaderSchema).optional(),
})

export const ApiMiddlewareConfigSchema = z.object({
  basePaths: PathPatternsSchema.min(
    1,
    "At least one API base path is required",
  ),
  response: ApiResponseSchema.default({
    status: DEFAULT_API_LOCK_STATUS,
    body: DEFAULT_API_LOCK_BODY,
  }),
})

export const MiddlewareOptionsSchema = z.object({
  debug: DebugSchema,
  bypassPaths: PathPatternsSchema.optional(),
  website: WebsiteMiddlewareConfigSchema.optional(),
  api: ApiMiddlewareConfigSchema.optional(),
})

export const MiddlewareOptionsWithoutNonceSchema = z.object({
  debug: DebugSchema,
  bypassPaths: PathPatternsSchema.optional(),
  website: WebsiteMiddlewareConfigWithoutNonceSchema.optional(),
  api: ApiMiddlewareConfigSchema.optional(),
})

export const MiddlewareOptionsNextJsSchema = z.object({
  debug: DebugSchema,
  bypassPaths: PathPatternsSchema.optional(),
  website: WebsiteMiddlewareConfigNextJsSchema.optional(),
  api: ApiMiddlewareConfigSchema.optional(),
})

export const AppwardenMiddlewareConfigSchema = MiddlewareOptionsSchema.extend({
  appwardenApiToken: AppwardenApiTokenSchema,
  appwardenApiHostname: AppwardenApiHostnameSchema.optional(),
})

export const AppwardenMiddlewareConfigWithoutNonceSchema =
  MiddlewareOptionsWithoutNonceSchema.extend({
    appwardenApiToken: AppwardenApiTokenSchema,
    appwardenApiHostname: AppwardenApiHostnameSchema.optional(),
  })

export const AppwardenMiddlewareConfigNextJsSchema =
  MiddlewareOptionsNextJsSchema.extend({
    appwardenApiToken: AppwardenApiTokenSchema,
    appwardenApiHostname: AppwardenApiHostnameSchema.optional(),
  })

export const DomainMiddlewareOptionsSchema = MiddlewareOptionsSchema.extend({
  debug: BooleanSchema.optional(),
})

export const DomainMiddlewareOptionsWithoutNonceSchema =
  MiddlewareOptionsWithoutNonceSchema.extend({
    debug: BooleanSchema.optional(),
  })

export type MiddlewareOptionsType = z.infer<typeof MiddlewareOptionsSchema>
export type WebsiteMiddlewareConfigType = z.infer<
  typeof WebsiteMiddlewareConfigSchema
>
export type ApiMiddlewareConfigType = z.infer<typeof ApiMiddlewareConfigSchema>
export type AppwardenMiddlewareConfigType = z.infer<
  typeof AppwardenMiddlewareConfigSchema
>
export type DomainMiddlewareOptionsType = z.infer<
  typeof DomainMiddlewareOptionsSchema
>

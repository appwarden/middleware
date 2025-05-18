# @appwarden/middleware

![Test Coverage](https://img.shields.io/badge/coverage-97.58%25-brightgreen)
[![npm version](https://img.shields.io/npm/v/@appwarden/middleware.svg)](https://www.npmjs.com/package/@appwarden/middleware)
[![npm downloads](https://img.shields.io/npm/dm/@appwarden/middleware.svg)](https://www.npmjs.com/package/@appwarden/middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm provenance](https://img.shields.io/badge/npm-provenance-green)](https://docs.npmjs.com/generating-provenance-statements)

> Read the docs [to learn more](https://appwarden.io/docs)

## Stop in progress attacks in their tracks

### Core Features

- **Instant Quarantine**: Immediately redirects all visitors to a maintenance page when activated
- **Discord Integration**: Trigger lockdowns via Discord commands (`/quarantine lock your.app.io`)

### 3. Performance Optimizations

- **Background Synchronization**: Uses `waitUntil()` to update cache state without blocking responses
- **Minimal Runtime Overhead**: Lightweight implementation with negligible performance impact

## Installation

Compatible with websites powered by [Cloudflare](https://developers.cloudflare.com/pages/) or [Vercel](https://vercel.com).

For detailed usage instructions, please refer to our [documentation](https://appwarden.io/docs).

### Cloudflare

We recommend using the [`@appwarden/build-cloudflare-action`](https://github.com/appwarden/build-cloudflare-action) Github Action to deploy automatically on Cloudflare.

- Comes with nonce-based Content Security Policy support

> Read the docs [to get started](https://appwarden.io/docs/guides/cloudflare-integration)

```typescript
import {
  withAppwarden,
  useContentSecurityPolicy,
} from "@appwarden/middleware/cloudflare"

export default {
  fetch: withAppwarden((context) => ({
    debug: context.env.DEBUG,
    lockPageSlug: context.env.LOCK_PAGE_SLUG,
    appwardenApiToken: context.env.APPWARDEN_API_TOKEN,
    middleware: {
      before: [
        useContentSecurityPolicy({
          mode: "enforced",
          directives: {
            "script-src": ["self", "{{nonce}}"],
            "style-src": ["self", "{{nonce}}"],
          },
        }),
      ],
    },
  })),
}
```

### Vercel

> Read the docs [to get started](https://appwarden.io/docs/guides/vercel-integration)

```typescript
import { withAppwarden } from "@appwarden/middleware/vercel"

export default withAppwarden({
  cacheUrl: process.env.EDGE_CONFIG_URL || process.env.UPSTASH_URL,
  appwardenApiToken: process.env.APPWARDEN_API_TOKEN,
  vercelApiToken: process.env.VERCEL_API_TOKEN,
  lockPageSlug: "/maintenance",
})

// Configures middleware to match all routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test
```

## Security

This package is published with npm provenance enabled, which provides a verifiable link between the published package and its source code. For more information, see [npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

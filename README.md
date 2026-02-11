# @appwarden/middleware

![Test Coverage](https://img.shields.io/badge/coverage-95.58%25-brightgreen)
[![npm version](https://img.shields.io/npm/v/@appwarden/middleware.svg)](https://www.npmjs.com/package/@appwarden/middleware)
[![npm provenance](https://img.shields.io/badge/npm-provenance-green)](https://docs.npmjs.com/generating-provenance-statements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Read the docs [to learn more](https://appwarden.io/docs)

## Stop in progress attacks in their tracks

### Core Features

- **Instant Quarantine**: Immediately redirects all visitors to a maintenance page when activated
- **Discord Integration**: Trigger lockdowns via Discord commands (`/quarantine lock your.app.io`)
- **Nonce-based Content Security Policy (Cloudflare only)**: Deploy a nonce-based Content Security Policy to supercharge your website security
- **Minimal Runtime Overhead**: Negligible performance impact by using `event.waitUntil` for status checks

## Installation

Compatible with websites powered by [Cloudflare](https://developers.cloudflare.com/workers/static-assets/) or [Vercel](https://vercel.com).

For detailed usage instructions, please refer to our [documentation](https://appwarden.io/docs).

## Supported Frameworks

### On Cloudflare

For all websites deployed on Cloudflare—including popular modern frameworks like Astro, Next.js, React Router, TanStack Start, and more—we recommend using the [build-cloudflare-action](https://github.com/appwarden/build-cloudflare-action). This action builds a worker that runs on the root of your domain (e.g., `your.app.io/*` for an `your.app.io` website), providing seamless integration with Appwarden without modifying your application code.

Please see the [build-cloudflare-action documentation](https://github.com/appwarden/build-cloudflare-action) for more information.

#### Recommended: build-cloudflare-action

- [build-cloudflare-action](https://github.com/appwarden/build-cloudflare-action) — Seamless integration with Appwarden for Cloudflare-deployed websites.

#### Framework adapters (alternative)

If you cannot use the `build-cloudflare-action`, you can use framework-specific adapters instead:

- [Astro](https://appwarden.io/docs/guides/astro-cloudflare)
- [React Router](https://appwarden.io/docs/guides/react-router-cloudflare)
- [TanStack Start](https://appwarden.io/docs/guides/tanstack-start-cloudflare)
- [Next.js](https://appwarden.io/docs/guides/nextjs-cloudflare)

### On Vercel

- [All websites on Vercel](https://appwarden.io/docs/guides/vercel-integration)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using the [Conventional Commits](https://www.conventionalcommits.org/) format
   - This project enforces commit message format with commitlint
   - Examples:
     - `feat: add new feature`
     - `fix: resolve issue with X`
     - `docs: update README`
     - `chore: update dependencies`
     - `refactor: improve code structure`
     - `test: add tests for feature X`
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

This package is published with npm trusted publishers, to prevent npm token exfiltration, and provenance enabled, which provides a verifiable link between the published package and its source code. For more information, see [npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# @appwarden/middleware

> Read the docs [to learn more](https://appwarden.io/docs)

## Stop in progress attacks in their tracks

Instantly halt all external access to a domain from your Discord server

```
/quarantine lock your.app.io
```

## Installation

Compatible with websites powered by [Cloudflare](https://developers.cloudflare.com/pages/) or [Vercel](https://vercel.com).

### Cloudflare

We recommend using the [`@appwarden/build-cloudflare-action`](https://github.com/appwarden/build-cloudflare-action) Github Action to deploy on Cloudflare.

> Read the docs [to get started](https://appwarden.io/docs/guides/cloudflare-integration)

### Vercel

> Read the docs [to get started](https://appwarden.io/docs/guides/vercel-integration)

## Security

### Package Provenance

This package is published with npm provenance enabled, which provides verifiable supply chain metadata that links the published package to its source code and build process. This helps users verify the authenticity and integrity of the package.

When you install this package, you can verify its provenance using:

```bash
npm audit signatures
```

The provenance information includes:

- The source repository where the code was built from
- The specific commit that triggered the build
- The CI/CD workflow that built and published the package

For more information about npm package provenance, see the [npm documentation](https://docs.npmjs.com/generating-provenance-statements).

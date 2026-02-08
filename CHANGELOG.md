# Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [3.1.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.0.3...@appwarden/middleware@3.1.0) (2026-02-08)


### Features

* add support for React Router new context API ([8cfed30](https://github.com/appwarden/middleware/commit/8cfed30d758c81747ff6dad2940cbabce8a255eb))

## [3.0.3](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.0.2...@appwarden/middleware@3.0.3) (2026-02-07)


### Bug Fixes

* add missing 3.0.1 section to changelog ([d2c9771](https://github.com/appwarden/middleware/commit/d2c9771e78f0c991e4af8dabfbdc023cfe48042e))

## [3.0.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.0.1...@appwarden/middleware@3.0.2) (2026-02-07)


### Bug Fixes

* deduplicate changelog entries for 3.0.0 release ([1d0371f](https://github.com/appwarden/middleware/commit/1d0371fd4611e33d5bc023c42b5f0ec7c9809ab4))

## [3.0.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.0.0...@appwarden/middleware@3.0.1) (2026-02-07)


### Bug Fixes

* **isOnLockPage:** normalize trailing slashes to prevent redirect loops ([97da59a](https://github.com/appwarden/middleware/commit/97da59a95f478015d117d60a5addfdce4fb06ae4))
* prevent infinite redirect loop when already on lock page ([cb3ff79](https://github.com/appwarden/middleware/commit/cb3ff79cfbea5da1a9fe36e95d9f5c8d46c3a033))

# [3.0.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@2.0.0...@appwarden/middleware@3.0.0) (2026-02-07)


### Bug Fixes

* **security:** add pnpm override for wrangler CVE-2025-GHSA-36p8-mvp6-cv38 ([43c2896](https://github.com/appwarden/middleware/commit/43c28965d71e232b9bd45e43730e5db3dd1eea2c))


### Features

* **astro:** use official Astro types and add peer dependencies ([4d037ef](https://github.com/appwarden/middleware/commit/4d037efd9840a49e5dfd7026f64f7cae9ce53abd))


# [2.0.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.6.0...@appwarden/middleware@2.0.0) (2026-02-06)


* feat!: remove Next.js Pages Router bundle ([9091025](https://github.com/appwarden/middleware/commit/909102597197eab2e30b8a889bb840a184ce483a))


### BREAKING CHANGES

* Remove the deprecated Next.js Pages Router bundle that was
designed for @cloudflare/next-on-pages. This removes:

- The withAppwardenOnNextJs export
- The appwardenOnPagesNextJs runner function
- The NextJsConfigFnOutputSchema and NextJsConfigFnType schemas

Users should migrate to the modern Next.js Cloudflare bundle:
import { createAppwardenMiddleware } from '@appwarden/middleware/cloudflare/nextjs'

# [1.6.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.5.1...@appwarden/middleware@1.6.0) (2026-02-06)


### Bug Fixes

* correct getLockValue mock return type in test ([782a41a](https://github.com/appwarden/middleware/commit/782a41a091235aaaf0941fbd927fa4449b96775a))
* replace maybeQuarantine with direct checkLockStatus calls ([eef13e5](https://github.com/appwarden/middleware/commit/eef13e5d9cf8cfc5eef50c39e2207fc5a641311e))
* use NextResponse.next() for proper middleware pass-through ([a5b11eb](https://github.com/appwarden/middleware/commit/a5b11eb708b35ef8a595171d8ca325593d1b69e7))


### Features

* add after middleware support to Cloudflare config ([933f957](https://github.com/appwarden/middleware/commit/933f95779f3f7227d4e19c39df6119c82724bf43))
* add Cloudflare adapter configuration schemas ([c8387b2](https://github.com/appwarden/middleware/commit/c8387b25d7ab06acd28b5232a276a448e33122e7))
* add Cloudflare framework adapters ([5389943](https://github.com/appwarden/middleware/commit/53899439bb642d135bf44d5c79cfec29281970b5))
* add core checkLockStatus function ([38ba968](https://github.com/appwarden/middleware/commit/38ba9682ccd3651e66d2d5e273f744aa24161383))
* add framework-specific Cloudflare bundles ([428d302](https://github.com/appwarden/middleware/commit/428d302eb47b47f0b1b0613969624f5616063893))
* add new Cloudflare entry points to build config ([5691bfd](https://github.com/appwarden/middleware/commit/5691bfdaf46fb4ac53528ab98cba64c1f98fb7a7))
* add test coverage for all bundle exports ([fc293db](https://github.com/appwarden/middleware/commit/fc293dbea5846f46337be3f4d76d91880ce89ff1))

## [1.5.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.5.0...@appwarden/middleware@1.5.1) (2026-01-30)


### Bug Fixes

* add APPWARDEN_API_HOSTNAME optional binding for runtime API hostname configuration ([c66afe8](https://github.com/appwarden/middleware/commit/c66afe8d5602b1a56673b8645b9e88c909c28b41))
* pass APPWARDEN_API_HOSTNAME from env to test app context ([5f2a297](https://github.com/appwarden/middleware/commit/5f2a297aad893a911f245a21e15a777177f9d37d))

# [1.5.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.4.3...@appwarden/middleware@1.5.0) (2026-01-30)


### Features

* support `multidomainConfig` option to support multidomain csp and lock options ([305daa0](https://github.com/appwarden/middleware/commit/305daa0526cce6f951023807d4f885f20e9f1586))

## [1.4.3](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.4.2...@appwarden/middleware@1.4.3) (2026-01-29)
## [1.4.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.4.1...@appwarden/middleware@1.4.2) (2026-01-29)

### Bug Fixes

* improve CSP nonce generation using crypto.randomUUID() ([74853ed](https://github.com/appwarden/middleware/commit/74853edb4281033a7466a5484515659ee5eca310))
* improve escaping in error message insertion to prevent injection attacks ([431cb28](https://github.com/appwarden/middleware/commit/431cb28609151edbcc8948d885cf0f2710e8048c))
* improve tests ([0fd4ce3](https://github.com/appwarden/middleware/commit/0fd4ce3497fbde091d042cb8bafbd6ecbd53ce96))
* update check endpoints to point at the new service ([beff51f](https://github.com/appwarden/middleware/commit/beff51f3cd6e5a8d530aa37a56e753624a105172))
* use pnpm compatible sbom generator ([f1acfe1](https://github.com/appwarden/middleware/commit/f1acfe1b28ce0af3f6b835549f966fdf9254e703))
* workflow security improvements ([2ef5491](https://github.com/appwarden/middleware/commit/2ef549134bb828ec7b6e1fb45fca590cb43399f2))

## [1.4.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.4.0...@appwarden/middleware@1.4.1) (2026-01-28)

### Bug Fixes

* ensure release pipeline ([dd3915e](https://github.com/appwarden/middleware/commit/dd3915e00cf7fa52c38741cdc15bac34a9f35890))

# [1.4.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.3.1...@appwarden/middleware@1.4.0) (2025-06-02)

## [1.3.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.3.0...@appwarden/middleware@1.3.1) (2025-05-29)

# [1.3.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.2.25...@appwarden/middleware@1.3.0) (2025-05-29)

# [1.2.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.11...@appwarden/middleware@1.2.0) (2025-05-21)


### Bug Fixes

* remove gh auth line since we are already authed in ci ([cfae7d8](https://github.com/appwarden/middleware/commit/cfae7d8b57a9007e03b07ad3e4a5bfc0e2de66f9))
* remove paths from codeql analysis ([62ddf4b](https://github.com/appwarden/middleware/commit/62ddf4b8a559145625ca9a7b9683fca779ad6a00))

## [1.1.11](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.10...@appwarden/middleware@1.1.11) (2025-05-21)


### Bug Fixes

* missing coverage in checks on main ([af2dac6](https://github.com/appwarden/middleware/commit/af2dac651e2b4719e27e9ced3538d6db9d754c9d))

## [1.1.10](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.9...@appwarden/middleware@1.1.10) (2025-05-21)

## [1.1.5](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.5...main)

## [1.1.4](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.4...main)

## [1.1.3](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.3...main)

## [1.1.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.2...main)

## [1.1.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.1...main)

## [1.1.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.1.0...main)

## [1.0.19](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.0.19...main)

## [1.0.18](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.0.18...main)

## [1.0.17](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.0.17...main)

## [1.0.16](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.0.16...main)

## [1.0.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.0.1...main)

## [1.0.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@1.0.0...main)

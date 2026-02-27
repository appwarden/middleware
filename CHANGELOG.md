# Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [3.6.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.5.1...@appwarden/middleware@3.6.0) (2026-02-27)


### Features

* remove non-AppwardenConfig types from bundle exports ([7b2640d](https://github.com/appwarden/middleware/commit/7b2640da1c343be4b358aa1a06bb7984c722d806))

## [3.5.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.5.0...@appwarden/middleware@3.5.1) (2026-02-27)


### Reverts

* Revert "feat: remove non-AppwardenConfig types from bundle exports" ([1446af7](https://github.com/appwarden/middleware/commit/1446af70c6ec4314c90e9dce33b5f4882fdcfb5f))

## [3.4.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.4.1...@appwarden/middleware@3.4.2) (2026-02-26)


### Bug Fixes

* harden isResponseLike for CSP middleware ([829330f](https://github.com/appwarden/middleware/commit/829330f13ef7bb1775b4cd97f790b2b6af614a84))
* relax response check in adapters ([ab95430](https://github.com/appwarden/middleware/commit/ab954301452cc98f4c9f4664951084676297477b))
* satisfy isResponseLike test type checks ([3a3afe2](https://github.com/appwarden/middleware/commit/3a3afe22e6dace73411cb5b5bf83bac6e039d7c6))

## [3.4.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.4.0...@appwarden/middleware@3.4.1) (2026-02-26)


### Bug Fixes

* dry up middleware logging for cache and lock status ([e43e99f](https://github.com/appwarden/middleware/commit/e43e99ff7918f44c5a292725ec78d3d35465fa40))

# [3.4.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.3.0...@appwarden/middleware@3.4.0) (2026-02-25)


### Features

* add context-based debug logging and fix type/check issues ([cb0874c](https://github.com/appwarden/middleware/commit/cb0874c1a30362f02f38f18ba757a7dd6a409623))

# [3.3.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.2.1...@appwarden/middleware@3.3.0) (2026-02-24)


### Bug Fixes

* clarify CSP nonce support for Next.js and Vercel ([5e64020](https://github.com/appwarden/middleware/commit/5e640205494a7738f8d10137465d74d13c70d8e3))
* gate CSP middleware by hostname in Cloudflare runner ([b97195f](https://github.com/appwarden/middleware/commit/b97195ffec7ae45ffd35cbd6e3e087912c321345))
* read CSP config from multidomainConfig in Cloudflare runner ([0d79adf](https://github.com/appwarden/middleware/commit/0d79adf9589f2675dfebef8b7999361c9643b4bb))
* remove dynamic import type ([6da1060](https://github.com/appwarden/middleware/commit/6da106035997008170c9c7d6e8f88acf94c6cc06))
* remove dynamic import type ([e48bcc7](https://github.com/appwarden/middleware/commit/e48bcc74f009c0296e944442e6c31cb5cd1128d9))
* remove dynamic import type ([1dc9b6a](https://github.com/appwarden/middleware/commit/1dc9b6a99cc7236f837de22b79ef4cadd4166a2c))


### Features

* add universal CSP middleware support for cloudflare and vercel ([a21125c](https://github.com/appwarden/middleware/commit/a21125c5ffd412e37dc79a70e719bf35b1dd980d))

## [3.2.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.2.0...@appwarden/middleware@3.2.1) (2026-02-13)


### Bug Fixes

* auto-quote CSP keywords to prevent invalid headers ([aee4189](https://github.com/appwarden/middleware/commit/aee4189fea9ddcf46743fe24134d4b5b7eebb812))
* handle whitespace in CSP keyword values ([ee6c5c2](https://github.com/appwarden/middleware/commit/ee6c5c233dc6eb43a48885677d699b0792f0cd6a))

# [3.2.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.1.1...@appwarden/middleware@3.2.0) (2026-02-11)


### Bug Fixes

* address prettier formatting issues ([5ac81c2](https://github.com/appwarden/middleware/commit/5ac81c28664d088f56f3a0796fe8179cdc6195b6))
* correct debug Error serialization and test mock isolation ([ea9f42f](https://github.com/appwarden/middleware/commit/ea9f42fa9581b2e354522d77a8def27e84cd025d))


### Features

* redirect to lock page instead of rendering inline ([fe18d62](https://github.com/appwarden/middleware/commit/fe18d62cdb9298d6bd1c6cf3617a33073f0a57ac))

## [3.1.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.1.0...@appwarden/middleware@3.1.1) (2026-02-10)


### Bug Fixes

* add test for isOnLockPage short-circuit to prevent redirect loops ([b0dc703](https://github.com/appwarden/middleware/commit/b0dc70319c6d82b927983ce5412d127c4b59598c))
* address copilot review feedback on PR [#160](https://github.com/appwarden/middleware/issues/160) ([602029b](https://github.com/appwarden/middleware/commit/602029b2373d2cae036d3b43cc198057c912dc27))
* check lock status before fetching origin to prevent SSR flash ([4cd1757](https://github.com/appwarden/middleware/commit/4cd17576eb3c4e1fdf74d2f2f9c9fd3749f3d8a2))
* reset-cache endpoint should call next() instead of returning 204 ([99023ac](https://github.com/appwarden/middleware/commit/99023ac94dac8be0cefe6af891be86e1f9d1cc54))
* simplify control flow with finally block ([1f4a180](https://github.com/appwarden/middleware/commit/1f4a1804803cc6a90fce8ff920d3c605852955fa))

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

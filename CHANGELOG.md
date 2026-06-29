# Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.16.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.16.1...@appwarden/middleware@3.16.2) (2026-06-29)


### Bug Fixes

* address Copilot review feedback on PR [#362](https://github.com/appwarden/middleware/issues/362) ([d9641fb](https://github.com/appwarden/middleware/commit/d9641fb37530787e25300970773dcc48887017a4))
* **heartbeat:** remove unnecessary any cast for invalid_type received ([bbfd4e3](https://github.com/appwarden/middleware/commit/bbfd4e3961c97bbf87b19c85ca2c9e11ecd5c89b))
* **schemas:** provide granular heartbeat errors for missing token and unsupported nonce ([51a7062](https://github.com/appwarden/middleware/commit/51a7062f91cf766e1b29ae39b67c22f3ccfc267c))

### Features

* add support for i18n validation error messages ([10c46fd](https://github.com/appwarden/middleware/commit/10c46fdb31e0920b33921a88d89867ee1583360c))

## [3.16.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.16.0...@appwarden/middleware@3.16.1) (2026-06-25)


### Bug Fixes

* **link:** handle empty middleware array and empty config response ([6787a1c](https://github.com/appwarden/middleware/commit/6787a1ccace7494b98f159fc9f5523d905847704))

# [3.16.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.15.5...@appwarden/middleware@3.16.0) (2026-06-18)


### Features

* prepare minor release 3.16.0 ([7bf7c0e](https://github.com/appwarden/middleware/commit/7bf7c0ea4bc8ed36530705b5b1eafcd27df02938))

## [3.15.5](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.15.4...@appwarden/middleware@3.15.5) (2026-06-18)


### Bug Fixes

* **audit:** override undici to >=7.28.0 to resolve CVE ([1683ea1](https://github.com/appwarden/middleware/commit/1683ea1de55515d0c1b118b69682d202b23e414a))

## [3.15.4](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.15.3...@appwarden/middleware@3.15.4) (2026-06-03)


### Bug Fixes

* consolidate debug log message for merged configuration ([96cea0b](https://github.com/appwarden/middleware/commit/96cea0b020d65a69c0040bd2900d3f8d972de116))

## [3.15.3](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.15.2...@appwarden/middleware@3.15.3) (2026-06-03)


### Bug Fixes

* improve debug output formatting in appwarden-link ([b6209e2](https://github.com/appwarden/middleware/commit/b6209e2fa3c5b483ea4c3f7817ecf137ea096755))

## [3.15.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.15.1...@appwarden/middleware@3.15.2) (2026-06-02)


### Bug Fixes

* correct package entry points and improve link script auth/debug handling ([f13366c](https://github.com/appwarden/middleware/commit/f13366cfb725f739fb3139427383defc3c510580))

## [3.15.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.15.0...@appwarden/middleware@3.15.1) (2026-05-29)


### Bug Fixes

* resolve two production-blocking security issues ([6ff87b3](https://github.com/appwarden/middleware/commit/6ff87b3726618c721ef372b42f403621d9943dc2))
* use JSON-safe escapes in htmlEscape and update tests for JSON-parseable attributes ([604a515](https://github.com/appwarden/middleware/commit/604a515afd029daa01c1827e6456c7933c46a031))

# [3.15.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.14.1...@appwarden/middleware@3.15.0) (2026-05-29)


### Bug Fixes

* address CodeQL alerts and CI test:coverage workerd segfault ([4221e4a](https://github.com/appwarden/middleware/commit/4221e4a8c7ea888ca2673ce0be649655aff54f8a))
* address Copilot review comments on PR [#316](https://github.com/appwarden/middleware/issues/316) - Update mock fetch wrapper to use body.getReader() and clarify nlink check comment ([5a02252](https://github.com/appwarden/middleware/commit/5a022524d167ad8e6ba77769023fe7b5a269ad40))
* address Copilot review comments on PR [#317](https://github.com/appwarden/middleware/issues/317) ([3f91d32](https://github.com/appwarden/middleware/commit/3f91d3234cc04c9d992729b3ca5b5c4d837893d5))
* address Copilot review comments on PR [#317](https://github.com/appwarden/middleware/issues/317) ([df0aa4b](https://github.com/appwarden/middleware/commit/df0aa4b450580b23d45b11c908de2b3c662252d6))
* address Copilot review comments on PR [#327](https://github.com/appwarden/middleware/issues/327) ([8b0abb1](https://github.com/appwarden/middleware/commit/8b0abb199fa1b54a89d0fff30303ff9f9836a427))
* **appwarden-link:** normalize legacy vercel.json object-map headers ([bc0c3a0](https://github.com/appwarden/middleware/commit/bc0c3a0e955deffa99455f82b7fd43e67e626eaf))
* **appwarden-link:** normalize quoted nonce placeholders and limit next.config discovery to JS ([8f8384c](https://github.com/appwarden/middleware/commit/8f8384c94e3a6f05c2effecefee7adf36725c857))
* **test-coverage-wrapper:** strip ANSI codes before regex matching ([e4f39d5](https://github.com/appwarden/middleware/commit/e4f39d51a77987ae92166f52767dbedc8d923505))


### Features

* apply ValidLockPageSlugSchema to adapter schemas and refine getAppwardenConfiguration ([9d4742e](https://github.com/appwarden/middleware/commit/9d4742ef14e4c526b323cb1fd7b4824097baf17e))
* **cli:** harden appwarden-link against path traversal and TOCTOU races ([162a40f](https://github.com/appwarden/middleware/commit/162a40fd68dc456c70f0cd9634a6c77868ff640d))
* synchronize remote configuration across adapters ([545c465](https://github.com/appwarden/middleware/commit/545c465b4d59b72722b6d34d1310cc705d81ccd4))

## [3.14.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.14.0...@appwarden/middleware@3.14.1) (2026-04-16)


### Bug Fixes

* tighten CSP nonce regex to avoid false positives on prefixed directives ([149652f](https://github.com/appwarden/middleware/commit/149652f7ab5ff8867563e3b19ff8f11b7af2899d))

# [3.14.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.13.4...@appwarden/middleware@3.14.0) (2026-03-31)


### Features

* add Appwarden middleware User-Agent header ([5508815](https://github.com/appwarden/middleware/commit/5508815ff9c620d9fa023e9cdf65949304e2cdd2))

## [3.13.4](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.13.3...@appwarden/middleware@3.13.4) (2026-03-26)


### Bug Fixes
* address PR 287 feedback ([32c6ef5](https://github.com/appwarden/middleware/commit/32c6ef53ccf0b6deec43019510b4212ea353ec92))
* address PR review comments ([774086b](https://github.com/appwarden/middleware/commit/774086b5dbe67ae08f32e2ed8b76863eed9898fb))

## [3.13.3](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.13.2...@appwarden/middleware@3.13.3) (2026-03-26)


### Bug Fixes

* heartbeat formatting improvements ([412801c](https://github.com/appwarden/middleware/commit/412801c40c7e77738f9b2b3118b0fc3bfc8a6b5a))
* improve config error messages ([6b083e8](https://github.com/appwarden/middleware/commit/6b083e85cc2b99ba51d443b4d8ca84fecf85999f))
* improve config error messages and edge sync behavior ([59ba09b](https://github.com/appwarden/middleware/commit/59ba09b586a9dfcbe877dea0ae4a4a03efb456cd))
* resolve picomatch security vulnerabilities ([c36128f](https://github.com/appwarden/middleware/commit/c36128f102229768dfa571be5b88e4a8f7ff08aa))
* resolve vitest 4 compatibility and CI errors ([4b45d12](https://github.com/appwarden/middleware/commit/4b45d124d86bc77fcdb0ee88e9a6d011af6a997a))
* use named cloudflare cache and expand mock cache tests ([d00e901](https://github.com/appwarden/middleware/commit/d00e901c36d62518052577b7531fd5358f3fe288))

## [3.13.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.13.1...@appwarden/middleware@3.13.2) (2026-03-19)


### Bug Fixes

* heartbeat formatting improvements ([63eae7d](https://github.com/appwarden/middleware/commit/63eae7d178d2d0a2259248597580175535a3f1d0))
* improve config error messages ([bd24c9c](https://github.com/appwarden/middleware/commit/bd24c9cd6cd20955af41cfffaf77a0a9ce66c9d0))

## [3.13.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.13.0...@appwarden/middleware@3.13.1) (2026-03-12)

# [3.13.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.12.0...@appwarden/middleware@3.13.0) (2026-03-11)


### Features

* tighten heartbeat schema contract ([48c3258](https://github.com/appwarden/middleware/commit/48c32583afff355afa7ba47e931eeba813ba9751))

# [3.12.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.6...@appwarden/middleware@3.12.0) (2026-03-11)


### Bug Fixes

* address heartbeat copilot feedback ([53f81ee](https://github.com/appwarden/middleware/commit/53f81eef23943d081f5cf8be06089e0305a1b757))
* address heartbeat review feedback ([6b60f13](https://github.com/appwarden/middleware/commit/6b60f130f13f8f24db6d993b18ef091698bfe9ce))
* address heartbeat review feedback ([8529f72](https://github.com/appwarden/middleware/commit/8529f7280440bc05264d8b29364f437cb7a6bb1d))
* centralize heartbeat contract constants ([c2e86da](https://github.com/appwarden/middleware/commit/c2e86dab09bf519eaf3717bf308bc30a0907d7dc))
* don't 405 on non-GET heartbeats ([7cae663](https://github.com/appwarden/middleware/commit/7cae66305d359b69a7fbbcc327423f025402fd16))
* handle cloudflare config evaluation zod errors ([80cbfca](https://github.com/appwarden/middleware/commit/80cbfca0f8b23d8a75ba350598f57a730df79c29))
* harden heartbeat adapters ([6f8d77d](https://github.com/appwarden/middleware/commit/6f8d77dca526f64e574d03552226404823025717))
* harden heartbeat handling ([f74f077](https://github.com/appwarden/middleware/commit/f74f0772bd5b1c5401c02657d011b50abe5d37c8))
* normalize heartbeat response config errors ([2ab2bc5](https://github.com/appwarden/middleware/commit/2ab2bc56389526ecd7fda8947f4f65064527037d))
* remove cf from cloudflare request context ([c9a9a96](https://github.com/appwarden/middleware/commit/c9a9a96fbe540d03cc6645f4df926e96905d6937))
* remove stale astro requestUrl reassignment ([080aa28](https://github.com/appwarden/middleware/commit/080aa2868eec599c92b980ab478a0cf48e3ecaac))
* share toNextResponse utility and align heartbeat typing ([f45e150](https://github.com/appwarden/middleware/commit/f45e15096317c2f322a9473699c6ee1b8103d316))


### Features

* add heartbeat endpoint for health monitoring ([a2aa596](https://github.com/appwarden/middleware/commit/a2aa5965d5b1fb8322e8bb024021cd1aaae3beff))

## [3.11.6](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.5...@appwarden/middleware@3.11.6) (2026-03-11)


### Bug Fixes

* harden cloudflare adapter response handling ([1fcf299](https://github.com/appwarden/middleware/commit/1fcf29949ee94b7f81cc26a840516baef89e3090))

## [3.11.5](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.4...@appwarden/middleware@3.11.5) (2026-03-11)


### Bug Fixes

* **changelog:** consolidate duplicate 3.11.3 entries into a single section ([950d163](https://github.com/appwarden/middleware/commit/950d1634dfce3797892fbf3b8328c8d1f4374469))

## [3.11.4](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.3...@appwarden/middleware@3.11.4) (2026-03-11)


### Bug Fixes

* apply top-level Cloudflare CSP config ([55059c2](https://github.com/appwarden/middleware/commit/55059c2c2dd0317511bd8fa59c470ed55d5ce83c))

## [3.11.3](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.2...@appwarden/middleware@3.11.3) (2026-03-11)


### Bug Fixes

* auto-exit dev mode before lint-staged ([a3dc7f8](https://github.com/appwarden/middleware/commit/a3dc7f83ad20b9264f5ae60258a94ef321629cad))
* **cloudflare:** type middleware api as config function ([f86247e](https://github.com/appwarden/middleware/commit/f86247e861273626802d965414b5c361ac8e157b))
* **cloudflare:** use RequestContext/Bindings types in tests and app, remove redundant tar override ([668309c](https://github.com/appwarden/middleware/commit/668309c4f1de5748dea21e2a448894e03a86b1a8))

## [3.11.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.1...@appwarden/middleware@3.11.2) (2026-03-07)


### Bug Fixes

* share appwardenApiHostname schema ([047c68d](https://github.com/appwarden/middleware/commit/047c68d6a9b58856645653eda23200b050a88212))

## [3.11.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.11.0...@appwarden/middleware@3.11.1) (2026-03-07)


### Bug Fixes

* support appwardenApiHostname in vercel middleware ([53161e9](https://github.com/appwarden/middleware/commit/53161e90d4e64a9b02f289a2a3e24708f76dc86b))

# [3.11.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.10.2...@appwarden/middleware@3.11.0) (2026-03-06)


### Bug Fixes

* pass resolved debug value to useAppwarden middleware ([b31fcca](https://github.com/appwarden/middleware/commit/b31fccaa0c7232c52cc3d970625a0c64ecbbe506))


### Features

* add per-domain debug mode configuration ([8cf5d6b](https://github.com/appwarden/middleware/commit/8cf5d6b804465e8bcc033e11dc2b25cf93baca8d))

## [3.10.2](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.10.1...@appwarden/middleware@3.10.2) (2026-03-06)


### Bug Fixes

* add comprehensive tests for isHTMLRequest wildcard handling ([c0046db](https://github.com/appwarden/middleware/commit/c0046db4e6f106c66792b5bd9162694b5d5d4be1))
* add normalizeMethod utility and improve HTTP method handling ([2d1da9f](https://github.com/appwarden/middleware/commit/2d1da9f0c8f63d076854683b69252fbb4957d134))
* address PR review comments ([e21156c](https://github.com/appwarden/middleware/commit/e21156c3c9038925072cd04032fab97c276431e1))
* better redirect handling ([981ff9e](https://github.com/appwarden/middleware/commit/981ff9e0a2fb3ea5c0c13fe27ec93f7c72d6aada))
* clone request in error logging to prevent body consumption errors ([b369b6c](https://github.com/appwarden/middleware/commit/b369b6c5314fd2a87fdb5201337366cfae14aad2))
* env var typo ([6b5dca5](https://github.com/appwarden/middleware/commit/6b5dca5c4cb8ca67becb7ddc8c4a30a6ae7ab530))
* improve Accept header parsing and HTTP spec compliance ([57f989c](https://github.com/appwarden/middleware/commit/57f989cf7cb6fdd8ecff546881b31702da539609))
* improve HTTP handling for edge cases in middleware ([1719db5](https://github.com/appwarden/middleware/commit/1719db5cc12f8b62f2dd3cb6e7baa50b0e517ac1))
* prevent redirect loops and streaming body errors ([da1ab2d](https://github.com/appwarden/middleware/commit/da1ab2dcb82d636bb5274a4b62a24ae430715e50))
* simplify redirect handling by using default Request behavior ([b3a2a34](https://github.com/appwarden/middleware/commit/b3a2a34a381fbc26daab736c1730b97bbe7000d2))
* use conditional redirect mode based on HTTP method ([9cbe1c4](https://github.com/appwarden/middleware/commit/9cbe1c49e927e9ca9aa8391f35fe11683c82bd3a))
* use redirect manual for all requests ([b79d71e](https://github.com/appwarden/middleware/commit/b79d71e1773f05b45093e3f974315c7121ba3b73))

## [3.10.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.10.0...@appwarden/middleware@3.10.1) (2026-03-06)


### Bug Fixes

* add comprehensive tests for isHTMLRequest wildcard handling ([10739ac](https://github.com/appwarden/middleware/commit/10739ac1b1bb563bc50f975f01e7dfe30ebe01fb))
* better redirect handling ([c707201](https://github.com/appwarden/middleware/commit/c707201828e0577c00d6b4c5ea89af6eb0b32cc4))
* env var typo ([052cff7](https://github.com/appwarden/middleware/commit/052cff76331367ead0189d63d420e819cc6740f9))
* handle case-insensitive Accept headers in isHTMLRequest ([a7f7b78](https://github.com/appwarden/middleware/commit/a7f7b782cf5946058050fc9deb287e53cfead580))
* prevent redirect loops and streaming body errors ([b07ab1b](https://github.com/appwarden/middleware/commit/b07ab1be9fcf142eec93b13fa67e2479df8c4aa0))
* use redirect manual for all requests ([ca9f8ba](https://github.com/appwarden/middleware/commit/ca9f8babba121bb9d3845ba3d9595b6a024d8862))

# [3.10.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.9.1...@appwarden/middleware@3.10.0) (2026-03-06)


### Bug Fixes

* remove generics from cloudflare env ([c7e1bf6](https://github.com/appwarden/middleware/commit/c7e1bf62c54e217e6a1743a52e55ad58f08d1dde))


### Features

* ensure CloudflareEnv correctly merges with Wrangler-generated types ([d002dbc](https://github.com/appwarden/middleware/commit/d002dbc11bd7c086fe5ca679830d8255bba8d05c))
* update CloudflareEnv type to match Wrangler-generated bindings ([94899ac](https://github.com/appwarden/middleware/commit/94899ac0a6714ddcf1ecc28b026e240f3f77be75))

## [3.9.1](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.9.0...@appwarden/middleware@3.9.1) (2026-03-05)


### Bug Fixes

* use ctx.waitUntil from ExecutionContext in Next.js adapter ([0faf422](https://github.com/appwarden/middleware/commit/0faf4224e6c38e28da766a5a63d3f7d8aa0a3b09))

# [3.9.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.8.0...@appwarden/middleware@3.9.0) (2026-03-05)


### Features

* minor release from [#206](https://github.com/appwarden/middleware/issues/206) ([40e6d83](https://github.com/appwarden/middleware/commit/40e6d8313d84a88990ffef5f5ca912f51726ee37))

# [3.8.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.7.0...@appwarden/middleware@3.8.0) (2026-03-03)


### Features

* simplify React Router adapter with runtime context ([191a566](https://github.com/appwarden/middleware/commit/191a566a70985709c8243623b70c3511030ad91b))

# [3.7.0](https://github.com/appwarden/middleware/compare/@appwarden/middleware@3.6.0...@appwarden/middleware@3.7.0) (2026-03-03)


### Bug Fixes

* address copilot review feedback for tanstack start ([4ef7d5a](https://github.com/appwarden/middleware/commit/4ef7d5a7f5e3e920383861701c06564b1433e374))
* align tanstack start config type with schema ([d49f1e2](https://github.com/appwarden/middleware/commit/d49f1e2150c958b4d7b565777158b3895cdf34ab))
* delete adapters index file ([1e87136](https://github.com/appwarden/middleware/commit/1e87136726be76faa51a082f5a452b9e699c8027))
* override serialize-javascript override for rollup ([b08f2c6](https://github.com/appwarden/middleware/commit/b08f2c60e98fcdf74f03fa893f71e19193d3da92))


### Features

* simplify TanStack Start Cloudflare adapter ([7dfc200](https://github.com/appwarden/middleware/commit/7dfc200228ae1590db248c3db4ccbb881dce3a81))

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

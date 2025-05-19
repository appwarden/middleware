# Package Integrity Signing for @appwarden/middleware

This document explains how package integrity signing is implemented for the @appwarden/middleware package.

## What is Package Provenance?

Package provenance is a security feature that provides verifiable supply chain metadata that links a published npm package to its source code and build process. It helps users verify the authenticity and integrity of the package they're installing.

When a package is published with provenance, it includes cryptographically signed metadata that verifies:
- The source repository where the code was built from
- The specific commit that triggered the build
- The CI/CD workflow that built and published the package

This helps prevent supply chain attacks where malicious actors might try to publish compromised versions of popular packages.

## How We've Implemented Provenance

We've implemented package provenance in several ways to ensure the integrity of our published packages:

1. **Package.json Configuration**: We've added a `publishConfig.provenance` setting in our package.json file to enable provenance by default.

2. **Build Script Enhancement**: The `scripts/prepare-package.cjs` script has been updated to ensure the built package includes provenance configuration.

3. **GitHub Actions Workflow**: We've created a dedicated GitHub Actions workflow (`.github/workflows/publish.yml`) that properly configures the necessary permissions and settings for publishing with provenance.

4. **Semantic Release Configuration**: We've updated the `.releaserc` file to ensure semantic-release also respects the provenance settings.

## Requirements for Publishing with Provenance

To successfully publish packages with provenance, the following requirements must be met:

1. **npm CLI Version**: Use npm 9.5.0 or later.

2. **CI/CD Environment**: Publish from a supported CI/CD environment (currently GitHub Actions or GitLab CI/CD).

3. **OIDC Token Access**: The CI/CD workflow must have permission to mint ID tokens (`id-token: write` in GitHub Actions).

4. **Repository Configuration**: The package.json must have a valid `repository` field that matches where you're publishing from.

5. **Cloud-hosted Runner**: Use a cloud-hosted runner (not self-hosted) for the CI/CD workflow.

## Verifying Provenance

Users of our package can verify its provenance using:

```bash
npm audit signatures
```

This command will show the count of verified registry signatures and verified attestations for all packages in their project.

## Troubleshooting

If you encounter issues with package provenance:

1. **Check npm Version**: Ensure you're using npm 9.5.0 or later.
2. **Verify CI/CD Configuration**: Make sure the CI/CD workflow has the correct permissions.
3. **Check Repository Field**: Ensure the package.json has a valid repository field.
4. **Review Logs**: Check the npm publish logs for any specific errors related to provenance.

## References

- [npm Documentation on Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Blog: Introducing npm Package Provenance](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/)
- [Sigstore Documentation](https://www.sigstore.dev/)

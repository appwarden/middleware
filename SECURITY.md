# Security Policy

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| > 1.4.x | :white_check_mark: |
| < 1.4.x | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an email to security@appwarden.io. All security vulnerabilities will be promptly addressed.

Please do not disclose security vulnerabilities publicly until they have been handled by the security team.

The security team will acknowledge your email within 48 hours, and will send a more detailed response within 72 hours indicating the next steps in handling your report.

## Security Measures

This package implements several security measures:

1. **npm Provenance**: All published packages include npm provenance, providing a verifiable link between the published package and its source code.

2. **npm Trusted Publishing**: We use npm's Trusted Publishing with OIDC authentication, eliminating the need for long-lived access tokens and providing secure, automated publishing directly from GitHub Actions.

3. **Dependency Scanning**: We regularly scan dependencies for vulnerabilities and update them as needed.

4. **Code Scanning**: We use GitHub CodeQL to scan for potential security issues in our codebase.

5. **Secure Development Practices**: We follow secure coding practices and conduct code reviews with security in mind.


## npm Provenance

Package provenance is a security feature that provides verifiable supply chain metadata that links a published npm package to its source code and build process. It helps users verify the authenticity and integrity of the package they're installing.

When a package is published with provenance, it includes cryptographically signed metadata that verifies:
- The source repository where the code was built from
- The specific commit that triggered the build
- The CI/CD workflow that built and published the package

This helps prevent supply chain attacks where malicious actors might try to publish compromised versions of popular packages.

### How We've Implemented Provenance

We've implemented package provenance in several ways to ensure the integrity of our published packages:

1. **Package.json Configuration**: We've added a `publishConfig.provenance` setting in our package.json file to enable provenance by default.

2. **GitHub Actions Workflow**: We've created a dedicated GitHub Actions workflow (`.github/workflows/publish.yml`) that properly configures the necessary permissions and settings for publishing with provenance.

3. **Semantic Release Configuration**: We've updated the `.releaserc` file to ensure semantic-release also respects the provenance settings.

### Verifying Provenance

Users of our package can verify its provenance using:

```bash
npm audit signatures
```

This command will show the count of verified registry signatures and verified attestations for all packages in their project.

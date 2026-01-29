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

3. **Software Bill of Materials (SBOM)**: We automatically generate and publish SBOMs for every release, providing complete transparency about our dependencies and supply chain.

4. **Dependency Scanning**: We regularly scan dependencies for vulnerabilities and update them as needed.

5. **Code Scanning**: We use GitHub CodeQL to scan for potential security issues in our codebase.

6. **Secure Development Practices**: We follow secure coding practices and conduct code reviews with security in mind.

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

## Software Bill of Materials (SBOM)

A Software Bill of Materials (SBOM) is a comprehensive inventory of all components, libraries, and dependencies used in our software. It provides transparency into our supply chain and helps users understand what's included in our package.

### Why We Provide SBOMs

SBOMs are critical for:

- **Supply Chain Security**: Identify and track all dependencies in the software supply chain
- **Vulnerability Management**: Quickly determine if your software is affected by newly discovered vulnerabilities
- **License Compliance**: Understand the licenses of all components used in the package
- **Risk Assessment**: Evaluate the security posture of the entire dependency tree
- **Regulatory Compliance**: Meet emerging requirements for software transparency (e.g., Executive Order 14028)

### Our SBOM Implementation

We automatically generate SBOMs for every release using industry-standard formats:

1. **Format**: We use the [CycloneDX](https://cyclonedx.org/) standard, which is widely adopted and supported by security tools
2. **Generation**: SBOMs are automatically generated during our release process via GitHub Actions
3. **Formats Available**: Both JSON and XML formats are provided for maximum compatibility
4. **Content**: Our SBOMs include:
   - All direct and transitive dependencies
   - Component versions and licenses
   - Package URLs (PURLs) for precise identification
   - Dependency relationships and hierarchy

### Accessing SBOMs

SBOMs are available in multiple ways:

#### 1. GitHub Releases

Every release includes SBOM files as release assets:

1. Go to our [Releases page](https://github.com/appwarden/middleware/releases)
2. Select the version you're interested in
3. Download the SBOM files from the release assets:
   - `sbom.json` - CycloneDX JSON format
   - `sbom.xml` - CycloneDX XML format

#### 2. GitHub Actions Artifacts

SBOMs are also available as workflow artifacts:

1. Go to the [Actions tab](https://github.com/appwarden/middleware/actions)
2. Select the release workflow run for your version
3. Download the SBOM artifact (retained for 90 days)

### Using SBOMs

Once you've downloaded an SBOM, you can use it with various security and compliance tools:

#### Vulnerability Scanning

Use tools like [Grype](https://github.com/anchore/grype) to scan for vulnerabilities:

```bash
# Install Grype
brew install grype

# Scan the SBOM for vulnerabilities
grype sbom:sbom.json
```

#### Dependency Analysis

Use [CycloneDX CLI](https://github.com/CycloneDX/cyclonedx-cli) for analysis:

```bash
# Install CycloneDX CLI
npm install -g @cyclonedx/cyclonedx-cli

# Validate the SBOM
cyclonedx validate --input-file sbom.json

# Analyze dependencies
cyclonedx analyze --input-file sbom.json
```

#### License Compliance

Extract license information from the SBOM:

```bash
# Using jq to extract licenses from JSON SBOM
jq '.components[] | {name: .name, version: .version, licenses: .licenses}' sbom.json
```

### SBOM Verification

Our SBOMs are generated in a trusted CI/CD environment with the following guarantees:

- Generated from the exact same commit that was released
- Created in an isolated, ephemeral GitHub Actions runner
- Generated after all security checks and tests have passed
- Includes cryptographic hashes for all components

### Automated SBOM Updates

We regenerate SBOMs for every release, ensuring they always reflect the current state of dependencies. Our release workflow:

1. Runs security audits on all dependencies
2. Builds the package
3. Generates fresh SBOMs from the build
4. Publishes the package with provenance
5. Attaches SBOMs to the GitHub release

### SBOM Standards Compliance

Our SBOMs comply with:

- **CycloneDX Specification**: Version 1.4+
- **NTIA Minimum Elements**: Includes all required elements defined by the National Telecommunications and Information Administration
- **SPDX Compatible**: Can be converted to SPDX format using standard tools

### Questions About SBOMs

If you have questions about our SBOMs or need them in a different format, please:

- Open an issue on our [GitHub repository](https://github.com/appwarden/middleware/issues)
- Contact us at security@appwarden.io

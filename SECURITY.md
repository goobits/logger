# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in `@goobits/logger`, **please do not open a public GitHub issue**.

Instead, use GitHub's private vulnerability reporting:

1. Open the [Security advisories page](https://github.com/goobits/logger/security/advisories) for this repository.
2. Click **Report a vulnerability**.
3. Provide a clear description of the issue, a minimal reproduction, and the package version affected.

You can also email `security@goobits.com` if private GitHub reporting is unavailable to you. Please include "security advisory" in the subject line.

We aim to acknowledge new reports within 5 business days and to ship a fix or mitigation guidance within 30 days, depending on severity.

## Supported versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | :white_check_mark: |

## Scope

In scope:

- Log injection / output-stream poisoning (e.g., crafted user input that escapes the log line format)
- Sensitive data leakage from default formatters (PII, tokens, secrets passed via the `context` object that are not redacted by the caller)
- Bugs in the `safeStringify` serializer that cause crashes, infinite loops, or memory exhaustion
- Cross-context bleed in `withLogContextAsync` (one async chain's context appearing in another)

Out of scope:

- Consumer-side decisions to log credentials or PII (the package logs whatever context you give it; redaction is the caller's responsibility)
- Vulnerabilities in transitive peer dependencies (please report upstream)
- Issues that require an already-compromised host or already-leaked secret

## Disclosure

After a fix lands, we will publish a GitHub Security Advisory with credit to the reporter (unless anonymity is requested).

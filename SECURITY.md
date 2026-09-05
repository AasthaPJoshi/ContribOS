# Security Policy

## Supported versions

Before the first stable release, security fixes are provided for the latest published ContribOS v0.1 release line only.

## Reporting a vulnerability

Please do not report suspected vulnerabilities in a public GitHub issue.

Use GitHub's private vulnerability reporting / Security Advisory workflow for this repository when available.

Include:

- affected component
- reproduction steps
- expected impact
- relevant logs with secrets removed
- whether the issue is remotely exploitable
- any known workaround

Do not include real credentials, GitHub tokens, private keys, webhook secrets, database passwords, session tokens, or credential-encryption keys in reports.

## Security model

ContribOS uses:

- GitHub App installation credentials for server-to-server GitHub access
- HMAC verification for GitHub webhooks
- opaque HttpOnly application sessions
- encrypted persisted GitHub user credentials
- repository-scope authorization
- conservative deterministic fallback when GitHub evidence is unavailable
- production security headers
- non-root container execution

Operational guidance is documented in `docs/runbooks/production-security.md`.

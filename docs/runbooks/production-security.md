# Production Security Runbook

## Security boundary

ContribOS v0.1 uses GitHub App installation authentication, GitHub OAuth, opaque HttpOnly browser sessions, encrypted GitHub user credentials at rest, HMAC-verified webhooks, repository-scope checks, conservative API security headers, request correlation, dependency-aware readiness, and non-root container execution.

## Browser and HTTP headers

The control plane sends `Cache-Control: no-store`, a restrictive Content Security Policy, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a restrictive Permissions Policy.

TLS termination and HTTP Strict Transport Security should be configured at the trusted ingress/reverse-proxy layer.

## Rate limiting

ContribOS does not trust arbitrary forwarded client-IP headers and therefore does not implement a misleading process-local IP rate limiter in v0.1. Production ingress should rate-limit public authentication and API endpoints using the platform's trusted client-IP information. GitHub webhook rate limiting must be configured carefully so legitimate deliveries and retries are not dropped.

## Single-instance production boundary

The current v0.1 production candidate is intended for a single control-plane instance. Before horizontal scaling, serialize schema migration ownership, replace process-local worker coordination with distributed coordination, decide sweep ownership, validate OAuth refresh concurrency across replicas, validate shared ingress rate limiting, and perform multi-replica failure testing.

Do not describe v0.1 as horizontally production-ready until those controls exist.

## GitHub App visibility

Before public release, explicitly review whether the GitHub App should remain public or be limited to the intended installation audience. This is a GitHub-side configuration decision and cannot be verified solely from the repository.

## Release security gate

Run:

```sh
./scripts/ops/verify-production-readiness.sh
```

The gate checks repository hygiene, high-confidence credential patterns, required security controls, production configuration validation, targeted security tests, the full repository verification suite, and a Docker image build when Docker is available.

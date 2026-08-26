# Phase 2: GitHub App Authentication

## Goal

Give ContribOS a production-oriented authentication boundary for GitHub App API access without Personal Access Tokens.

## Completed capabilities

- RS256 GitHub App JWT generation
- short-lived GitHub App JWT claims
- installation access token exchange
- strict installation-token response validation
- installation token expiry parsing
- installation token caching
- early refresh before expiry
- concurrency-safe per-installation token refresh
- explicit cache invalidation
- authenticated GitHub API client
- one-time token refresh and retry after HTTP 401
- installation permission validation
- selected-repository scope validation
- fail-closed repository authorization
- GitHub API version and media-type headers
- typed authentication and API errors
- negative-path and security-oriented tests
- tests using generated RSA keys and mocked GitHub HTTP responses

## Security properties

- GitHub App private keys are not included in thrown error messages
- installation tokens are not included in thrown error messages
- installation IDs must be positive integers
- API paths must be relative GitHub API paths
- selected-repository installations fail closed when repository scope cannot be proven
- permission requirements are checked before an API request is made
- only HTTP 401 triggers one authentication refresh and retry
- concurrent token refreshes for the same installation share one in-flight request
- Personal Access Tokens are not used

## Phase 2 boundary

Phase 2 does not yet implement:

- live GitHub App registration and installation
- live reconciliation of pull request state
- PostgreSQL persistence
- Redis or BullMQ workers
- production deployment
- web user interface

Those capabilities belong to later phases.

# Changelog

All notable ContribOS releases will be documented here.

The project follows semantic versioning once public versioned releases begin.

## [Unreleased]

### Added

- Public open-source release foundation.
- Contribution, security, conduct, and release documentation.

## [0.1.0] - Unreleased

### Added

- Deterministic pull request workflow state engine.
- GitHub App installation authentication and permission enforcement.
- Signed GitHub webhook ingestion with idempotency and retry recovery.
- GitHub API reconciliation.
- Durable PostgreSQL persistence and migrations.
- Durable worker orchestration and retry policy.
- Repository dashboards and maintainer attention queue.
- Contribution detail and decision trail.
- GitHub OAuth authentication and repository authorization.
- Encrypted GitHub user credential persistence and token refresh.
- Repository installation sync.
- Runtime health, readiness, structured request observability, and graceful shutdown.
- Production Docker build and deployment runbooks.
- Final production security and verification gate.

### Release boundary

v0.1.0 is a single-instance production candidate. Distributed multi-replica coordination is intentionally outside this release.

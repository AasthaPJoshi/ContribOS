# ContribOS

**ContribOS is a GitHub-native contribution operations and trust layer for maintainers and contributors.**

It turns repository evidence into a deterministic answer to the questions that slow contribution workflows down:

- What needs attention next?
- Who owns the next action?
- Why is this contribution blocked?
- Is it ready for review?
- Is it ready to merge?
- Is it ready for release?
- Is the available evidence incomplete or contradictory?

## Why ContribOS

GitHub already stores the evidence, but teams still have to manually interpret reviews, checks, mergeability, repository policy, stale state, and ownership.

ContribOS builds a deterministic control plane over that evidence.

The core rule is simple:

> **GitHub evidence determines canonical workflow state. AI may explain or summarize that state, but AI does not decide it.**

## Core model

ContribOS evaluates contribution state across three dimensions:

- `WorkflowState`
- `NextActor`
- `Readiness`

When evidence is unavailable or inconsistent, ContribOS prefers `UNKNOWN` or `AMBIGUOUS` over inventing certainty.

## Current v0.1 architecture

```text
GitHub App
   |
   +--> Webhooks --------+
   |                     |
   +--> GitHub API       |
                         v
                 Control Plane
                         |
             +-----------+-----------+
             |                       |
             v                       v
        Durable Worker        Reconciliation
             |                       |
             +-----------+-----------+
                         |
                         v
                  PostgreSQL
                         |
                         v
              Deterministic State
                         |
                         v
                 Product Query API
                         |
                         v
                    Web UI
```

The v0.1 production candidate includes:

- GitHub App authentication
- signed webhook verification
- webhook idempotency and retry recovery
- GitHub API reconciliation
- durable PostgreSQL persistence
- deterministic contribution-state evaluation
- worker orchestration
- repository authorization
- GitHub OAuth user authentication
- encrypted user credentials
- maintainer attention queue
- contribution decision trail
- repository dashboard
- readiness and liveness probes
- structured request observability
- graceful shutdown
- production Docker build
- production configuration and security verification gates

## Packages

- `@contribos/domain` - shared domain contracts
- `@contribos/state-engine` - deterministic contribution evaluation
- `@contribos/github` - GitHub App, API, webhook, evidence, and reconciliation logic
- `@contribos/db` - PostgreSQL schema, migrations, and repositories
- `@contribos/worker` - durable job execution and retry orchestration
- `@contribos/control-plane` - application runtime, auth, HTTP API, and product services
- `@contribos/web` - maintainer-facing web application

## Development

Requirements:

- Node.js 24
- pnpm 10
- PostgreSQL

Install dependencies:

```sh
pnpm install
```

Run the complete verification gate:

```sh
pnpm verify
```

That runs:

```text
tests -> typecheck -> production build
```

## Local configuration

Copy the environment template and configure local values:

```sh
cp .env.example .env.local
```

Never commit `.env.local`, `.secrets/`, GitHub private keys, OAuth secrets, webhook secrets, database credentials, or credential-encryption keys.

## Production verification

The v0.1 release candidate includes a repeatable production gate:

```sh
./scripts/ops/verify-production-readiness.sh
```

It verifies repository hygiene, high-confidence secret patterns, security controls, production configuration, targeted security tests, the full monorepo verification suite, and the Docker image when Docker is available.

See `docs/runbooks/` for deployment and operations guidance.

## Current release boundary

ContribOS v0.1 is designed as a **single-instance production candidate**.

Horizontal scaling requires additional distributed coordination for migration ownership, worker locking, sweep ownership, and related multi-replica behavior.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache License 2.0](LICENSE).

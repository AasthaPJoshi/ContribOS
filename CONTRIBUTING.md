# Contributing to ContribOS

Thanks for helping improve ContribOS.

## Development principles

ContribOS is built around a few non-negotiable rules:

1. deterministic GitHub evidence is canonical
2. uncertainty must remain visible
3. AI must not silently determine workflow state or ownership
4. security-sensitive behavior should fail closed
5. webhook speed must be paired with reconciliation for correctness
6. operational state that matters after restart belongs in durable storage

## Local setup

Requirements:

- Node.js 24
- pnpm 10
- PostgreSQL

Install dependencies:

```sh
pnpm install
```

Create local configuration:

```sh
cp .env.example .env.local
```

Do not commit local credentials or secret files.

## Verification

Before opening a pull request:

```sh
pnpm verify
```

For production/security-sensitive changes, also run:

```sh
./scripts/ops/verify-production-readiness.sh
```

## Pull requests

Keep pull requests focused.

A useful pull request should explain:

- the problem
- the chosen approach
- relevant design or security tradeoffs
- how the change was tested
- whether migrations or deployment behavior changed

Tests are expected for behavioral changes.

## Architecture changes

Material architecture decisions should be documented in `docs/adr/`.

Changes to deterministic state semantics should include tests showing both the intended state and conservative fallback behavior.

## Database migrations

Do not edit an already-applied migration.

Generate a new forward migration and review the SQL before committing it.

## Security

Do not open public issues containing credentials, private keys, access tokens, refresh tokens, webhook secrets, database credentials, or encryption keys.

See `SECURITY.md` for vulnerability reporting guidance.

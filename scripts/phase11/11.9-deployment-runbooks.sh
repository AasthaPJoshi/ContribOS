#!/usr/bin/env bash
set -euo pipefail

echo "== ContribOS Phase 11.9: deployment configuration + production runbooks =="

mkdir -p deploy docs/runbooks scripts/ops

cat > .env.production.example <<'EOF'
# ContribOS production environment contract.
# Never commit real values. Inject secrets from your deployment platform.

# GitHub App
GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Multiline PEM private key.
# Prefer a secret manager that can inject the complete PEM value.
GITHUB_PRIVATE_KEY=

# Public browser-facing HTTPS origin, for example:
# https://contribos.example.com
CONTRIBOS_PUBLIC_BASE_URL=

# Base64-encoded 32-byte credential encryption key.
# Generate once and store in a secret manager:
# openssl rand -base64 32
CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY=

# PostgreSQL connection string.
DATABASE_URL=

# Control plane
CONTRIBOS_HOST=0.0.0.0
PORT=3000
CONTRIBOS_RECONCILIATION_SWEEP_INTERVAL_MS=300000

# Authentication lifetimes
CONTRIBOS_SESSION_TTL_SECONDS=604800
CONTRIBOS_OAUTH_STATE_TTL_SECONDS=600

# Reserved for later distributed worker infrastructure.
# The current runtime does not require Redis.
# REDIS_URL=
EOF

cat > .dockerignore <<'EOF'
.git
.github
.turbo
node_modules
**/node_modules
**/dist
.env
.env.*
!.env.example
!.env.production.example
.secrets
**/.secrets
coverage
*.log
.DS_Store
EOF

cat > deploy/Dockerfile.control-plane <<'EOF'
# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/control-plane/package.json apps/control-plane/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/github/package.json packages/github/package.json
COPY packages/state-engine/package.json packages/state-engine/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/db/package.json packages/db/package.json

RUN pnpm install --frozen-lockfile

COPY apps/control-plane apps/control-plane
COPY packages/domain packages/domain
COPY packages/github packages/github
COPY packages/state-engine packages/state-engine
COPY packages/worker packages/worker
COPY packages/db packages/db

RUN pnpm --filter @contribos/control-plane... build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable \
    && groupadd --system contribos \
    && useradd --system --gid contribos --home-dir /app contribos

COPY --from=build --chown=contribos:contribos /app /app

USER contribos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@contribos/control-plane", "start"]
EOF

cat > scripts/ops/preflight-production.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

required=(
  DATABASE_URL
  GITHUB_APP_ID
  GITHUB_PRIVATE_KEY
  GITHUB_WEBHOOK_SECRET
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  CONTRIBOS_PUBLIC_BASE_URL
  CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY
)

missing=()

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing required production environment variables:\n' >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

case "$CONTRIBOS_PUBLIC_BASE_URL" in
  https://*)
    ;;
  *)
    echo "CONTRIBOS_PUBLIC_BASE_URL must use https in production." >&2
    exit 1
    ;;
esac

if [[ "${CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY}" == "change-me" ]]; then
  echo "Refusing placeholder credential encryption key." >&2
  exit 1
fi

echo "Production configuration preflight passed."
EOF
chmod +x scripts/ops/preflight-production.sh

cat > docs/runbooks/README.md <<'EOF'
# ContribOS Operations Runbooks

These runbooks describe the v0.1 production operating model for the ContribOS control plane.

Runbooks:

- `production-deployment.md` - deploy, validate, rollback, and shutdown behavior
- `database-migrations.md` - migration ownership and safety
- `secret-rotation.md` - GitHub App, OAuth, webhook, and encryption-key handling
- `incident-response.md` - first-response workflow for service and dependency failures
- `backup-restore.md` - PostgreSQL backup and restore expectations

The deterministic GitHub evidence model remains canonical. Operational automation must not invent contribution state, ownership, or readiness.
EOF

cat > docs/runbooks/production-deployment.md <<'EOF'
# Production Deployment Runbook

## Deployment model

The v0.1 control plane is a Node.js service backed by PostgreSQL and a GitHub App.

The service:

1. validates required environment configuration
2. connects to PostgreSQL
3. runs Drizzle migrations before serving traffic
4. starts the HTTP server
5. marks runtime readiness
6. starts the reconciliation worker and sweep scheduler

`GET /live` is a process liveness probe.

`GET /ready` is a traffic-readiness probe and includes dependency checks. A database failure returns HTTP 503.

## Required production configuration

Inject these values through the deployment platform or secret manager:

- `DATABASE_URL`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `CONTRIBOS_PUBLIC_BASE_URL`
- `CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY`

`CONTRIBOS_PUBLIC_BASE_URL` must be HTTPS outside loopback development.

Do not bake secrets into the container image, Docker build arguments, source control, CI logs, or shell history.

## Preflight

Load the intended production environment without printing secret values, then run:

```sh
./scripts/ops/preflight-production.sh
```

Run the repository verification gate:

```sh
pnpm verify
```

## Container build

From the repository root:

```sh
docker build -f deploy/Dockerfile.control-plane -t contribos-control-plane:<immutable-tag> .
```

Use an immutable tag such as a Git commit SHA in real deployments.

## Probe configuration

Configure the platform with:

- liveness: `GET /live`
- readiness: `GET /ready`
- container port: `3000` unless `PORT` is overridden

Do not route normal traffic to an instance until `/ready` returns HTTP 200.

If `/ready` later exposes additional operational details, restrict it at the infrastructure boundary.

## GitHub App configuration

The GitHub App callback URL must resolve to:

```text
<CONTRIBOS_PUBLIC_BASE_URL>/auth/github/callback
```

The webhook URL must resolve to:

```text
<control-plane-public-origin>/webhooks/github
```

Keep only the minimum GitHub App permissions required by ContribOS.

## Rollout

Recommended v0.1 sequence:

1. produce a tested immutable artifact
2. verify production secrets and configuration
3. deploy one new instance
4. wait for `/ready` to return HTTP 200
5. verify structured startup logs
6. send a controlled GitHub webhook or reconciliation test
7. verify the expected contribution/evidence update
8. move production traffic to the new version
9. watch error logs and readiness during the observation window

## Graceful shutdown

The service handles `SIGINT` and `SIGTERM`.

During shutdown it:

- marks itself not ready
- stops the sweep scheduler
- stops accepting new HTTP connections
- waits for an in-flight sweep
- requests worker shutdown
- waits for the worker loop
- clears GitHub installation tokens
- closes PostgreSQL

The platform termination grace period must be long enough for this drain sequence.

## Rollback

Application rollback is safe only when the previous application version is compatible with the already-applied database schema.

Do not automatically reverse a Drizzle migration during an incident.

Preferred rollback:

1. stop routing traffic to the unhealthy version
2. preserve database state
3. deploy the last known-good application artifact if schema-compatible
4. validate `/live` and `/ready`
5. verify a reconciliation path
6. investigate the failed version offline

For destructive or incompatible schema changes, use an explicit forward-fix or a separately reviewed database recovery plan.
EOF

cat > docs/runbooks/database-migrations.md <<'EOF'
# Database Migration Runbook

## Current behavior

The control plane runs Drizzle migrations during startup before it begins listening for traffic.

Startup fails if:

- the migration directory is unavailable
- the Drizzle migration journal is unavailable
- a migration fails

The service must never report ready after a failed migration.

## Single-instance v0.1 deployment

For one production control-plane instance, startup migration execution is the supported v0.1 path.

## Multiple replicas

Do not scale startup migration ownership to multiple simultaneous replicas without a reviewed coordination strategy.

Before multi-replica production deployment, choose one of:

- a dedicated migration job before application rollout
- deployment-platform serialization
- an explicit PostgreSQL advisory-lock migration wrapper

Only one actor should own schema migration execution for a release.

## Migration review checklist

Before rollout:

1. inspect generated SQL
2. confirm additions/defaults/nullability
3. identify table-lock or rewrite risk
4. confirm old/new application compatibility
5. take or verify a recent PostgreSQL backup
6. run `pnpm verify`
7. test migration against a production-like database

Never edit an already-applied migration in place.

Create a new forward migration instead.

## Failure response

If startup migration fails:

1. keep the new version out of traffic
2. capture the migration error without leaking credentials
3. inspect PostgreSQL state and the Drizzle journal
4. determine whether the failed statement committed
5. fix forward with a reviewed migration or restore from backup when required
6. redeploy only after verifying the recovery path
EOF

cat > docs/runbooks/secret-rotation.md <<'EOF'
# Secret Rotation Runbook

ContribOS uses several independent credentials. Rotate them independently and never print their values.

## GitHub webhook secret

1. create a new high-entropy webhook secret
2. update the GitHub App webhook configuration
3. update the deployment secret
4. restart or redeploy the control plane
5. verify signed webhook acceptance
6. verify invalid signatures are rejected

Coordinate the update to avoid a period where GitHub and ContribOS use different secrets.

## GitHub OAuth client secret

1. create/rotate the secret in GitHub
2. update the deployment secret
3. redeploy
4. complete a fresh GitHub login
5. verify session creation and repository authorization

Existing user tokens are separate from the OAuth client secret.

## GitHub App private key

1. generate a new GitHub App private key
2. store it in the secret manager
3. update `GITHUB_PRIVATE_KEY`
4. redeploy and verify GitHub installation-token creation
5. remove the old GitHub App key only after successful validation

## Credential encryption key

`CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY` encrypts persisted GitHub user credentials.

Do not rotate it by simply replacing the environment value. Existing ciphertext would become unreadable.

A future key-rotation mechanism must support decrypt-with-old / encrypt-with-new migration or versioned keys.

Until that mechanism exists:

- treat the encryption key as a high-value durable secret
- back it up securely
- restrict access
- do not rotate it casually
- if compromised, revoke affected GitHub credentials and force reauthentication as part of a reviewed recovery procedure
EOF

cat > docs/runbooks/incident-response.md <<'EOF'
# Incident Response Runbook

## First five minutes

1. determine whether `/live` responds
2. determine whether `/ready` returns 200 or 503
3. inspect structured logs using `requestId`, event name, and timestamps
4. determine whether the failure is HTTP, PostgreSQL, GitHub API, webhook, worker, or reconciliation related
5. stop rollout or remove unhealthy instances from traffic when necessary

Do not change deterministic contribution state manually merely to make the UI look healthy.

## Process alive, readiness failing

If `/live` is healthy but `/ready` is 503:

- inspect the readiness `checks`
- verify PostgreSQL connectivity
- inspect database saturation and connection limits
- verify credentials/network/DNS
- keep the instance out of normal traffic until readiness returns

## Webhook failures

Use the GitHub delivery ID as the primary correlation identifier.

Check:

- signature rejection
- unsupported event/action
- delivery retryability
- duplicate delivery handling
- enqueue failure
- stale claimed-delivery recovery

Do not replay a webhook blindly if the delivery has already been processed.

## Worker/reconciliation failures

Inspect:

- worker job error code/message
- retry count
- repository registration
- GitHub installation access
- GitHub API response class
- branch-policy availability
- reconciliation reason code

ContribOS intentionally prefers `UNKNOWN`/`AMBIGUOUS` over fabricating readiness when GitHub evidence is unavailable.

## OAuth/session failures

Check:

- public base URL and callback URL
- HTTPS/cookie behavior
- OAuth client configuration
- access-token expiry
- refresh-token availability
- repository installation access

Do not log or paste access tokens, refresh tokens, client secrets, private keys, webhook secrets, or encryption keys.

## Request correlation

HTTP responses include `x-request-id`.

Structured request completion logs contain:

- request ID
- method
- sanitized path
- status code
- duration
- in-process request counters

Use request IDs to correlate client-visible failures with server logs.
EOF

cat > docs/runbooks/backup-restore.md <<'EOF'
# PostgreSQL Backup and Restore Runbook

## Backup policy

Production PostgreSQL must use automated backups appropriate to the hosting platform.

At minimum:

- daily recoverable backups
- retention appropriate to the project
- a backup before risky schema changes
- periodically tested restore procedures

For managed PostgreSQL, prefer provider-native point-in-time recovery where available.

## What the database contains

The database contains operational ContribOS state including:

- installations and repository inventory
- contributions
- normalized evidence
- reconciliation runs
- deterministic state evaluations/history
- webhook delivery lifecycle
- worker jobs
- users, sessions, OAuth state, and encrypted GitHub credentials

The credential encryption key is not stored in PostgreSQL and must be protected separately.

## Restore principle

A database backup is useful only together with the correct application version and the credential encryption key required to decrypt persisted credentials.

## Restore procedure

1. stop application writes
2. identify the target recovery point
3. restore PostgreSQL into an isolated database first when practical
4. verify expected tables and Drizzle migration state
5. configure a compatible ContribOS build against the restored database
6. validate `/live` and `/ready`
7. verify a known repository/contribution query
8. verify GitHub authentication/reconciliation
9. move traffic only after validation

Do not restore production data over a healthy database without an explicit incident decision and rollback plan.
EOF

cat > docs/product/phase-11.9-deployment.md <<'EOF'
# Phase 11.9 - Deployment Configuration and Runbooks

Phase 11.9 establishes the first explicit production deployment contract for ContribOS.

Delivered:

- production environment example
- secret-safe preflight validation
- control-plane Dockerfile
- Docker build exclusions
- liveness/readiness deployment guidance
- rollout and rollback procedure
- startup migration operating model
- secret rotation guidance
- incident-response guidance
- PostgreSQL backup/restore guidance

This phase documents the deployment boundary. It does not by itself certify ContribOS as production-ready.

Phase 11.10 remains responsible for the final security and production verification gate.
EOF

echo "== Phase 11.9 static validation =="

bash -n scripts/ops/preflight-production.sh
bash -n scripts/phase11/11.9-deployment-runbooks.sh

grep -q '^FROM node:24-bookworm-slim AS build$' deploy/Dockerfile.control-plane
grep -q 'HEALTHCHECK' deploy/Dockerfile.control-plane
grep -q 'USER contribos' deploy/Dockerfile.control-plane
grep -q 'CONTRIBOS_PUBLIC_BASE_URL=' .env.production.example
grep -q 'GITHUB_PRIVATE_KEY=' .env.production.example
grep -q 'DATABASE_URL=' .env.production.example

if command -v docker >/dev/null 2>&1; then
  echo "Docker detected. Validating Dockerfile parse/build surface."
  docker build \
    -f deploy/Dockerfile.control-plane \
    -t contribos-control-plane:phase11.9 \
    .
else
  echo "Docker not installed or not on PATH; skipping local image build."
fi

echo "== Full repository verification =="
pnpm verify

echo "== Phase 11.9 complete =="
echo "Review git diff before committing."

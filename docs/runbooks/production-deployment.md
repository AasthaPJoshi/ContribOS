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

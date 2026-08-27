# Phase 6: Application Integration and Runtime

## Goal

Connect GitHub webhook intake, durable queueing, worker execution, reconciliation, deterministic state evaluation, persistence, health endpoints, and scheduled repair into a runnable control-plane service.

## Runtime path

    POST /webhooks/github
        -> preserve raw body
        -> verify GitHub HMAC signature
        -> validate delivery/event metadata
        -> atomically claim delivery
        -> record webhook metadata
        -> normalize GitHub event
        -> enqueue durable reconciliation work
        -> mark delivery processed

    worker
        -> claim durable job
        -> resolve repository
        -> obtain GitHub App installation token
        -> reconcile GitHub pull request evidence
        -> deterministic state evaluation
        -> atomic persistence transaction

## HTTP endpoints

- `POST /webhooks/github`
- `GET /live`
- `GET /ready`

Webhook request bodies are capped at 2 MiB. Invalid signatures are rejected before a delivery is claimed.

## Scheduled reconciliation

The scheduler enumerates registered GitHub App installations and enqueues sweep jobs. Sweep jobs expand into known repositories and pull-request contributions, then enqueue normal reconciliation jobs.

## Shutdown

On `SIGINT` or `SIGTERM`, readiness is disabled, worker polling is stopped, sweep scheduling stops, the HTTP listener closes, token caches clear, and the database pool closes.

## Security and correctness

Phase 6 includes GitHub App installation-token authentication, repository and permission scope checks, caller Authorization override protection, webhook HMAC verification, delivery idempotency, bounded webhook stale-claim recovery, deterministic state evaluation, and transactional reconciliation persistence.

## Remaining pre-production work

- deployment-time migration execution
- distributed repository concurrency enforcement
- selected-repository installation scope reconciliation
- stronger GitHub API path validation
- response-body parsing cleanup
- GitHub rate-limit coordination
- transactional webhook outbox semantics
- metrics/tracing exporters
- deployment manifests
- live GitHub App integration tests
- full PostgreSQL and GitHub end-to-end tests

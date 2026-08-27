# Phase 5: Worker and Queue Orchestration

## Goal

Add durable asynchronous execution so webhook ingestion can hand work off quickly while reconciliation and repair run with explicit queue semantics.

## Completed capabilities

- dedicated `@contribos/worker` package
- typed reconciliation and sweep jobs
- stable deduplication keys
- queue-store abstraction
- in-memory reference store
- PostgreSQL-backed durable job storage
- atomic enqueue deduplication
- atomic claim using PostgreSQL row locking and skip-locked semantics
- retry scheduling
- bounded exponential backoff
- dead-job handling
- stale claim recovery
- failure classification
- worker observability hooks
- worker loop with graceful stop
- repository-scoped concurrency guard primitive
- webhook-to-job handoff adapter
- durable job migration tests
- worker lifecycle tests

## Durable queue

The `worker_jobs` table stores job type, payload, deduplication key, lifecycle status, attempts, availability, claim/completion/dead timestamps, and error metadata.

## Claim semantics

Workers claim one due job inside a database transaction using `FOR UPDATE SKIP LOCKED`, allowing multiple workers to compete safely without claiming the same queued row.

## Retry semantics

Retryable failures increment the attempt count and return to `QUEUED` with bounded exponential backoff.

Non-retryable failures and exhausted retries move to `DEAD`.

## Stale claim recovery

Jobs left in `CLAIMED` after a worker crash can be returned to `QUEUED` and tagged with `STALE_CLAIM`.

## Graceful shutdown

The worker loop supports a stop request and finishes the current iteration before exiting.

## Concurrency

Phase 5 provides the repository concurrency key:

    repo:<installationId>:<repositoryId>

The current guard is process-local. Distributed concurrency enforcement remains a later deployment concern.

## Observability

Lifecycle hooks exist for claimed, completed, rescheduled, dead, and idle events.

## Phase 5 boundary

Later phases should add:

- a production worker service/application
- scheduled sweep producer
- webhook outbox/transaction integration
- distributed rate limiting
- GitHub API rate-limit coordination
- production metrics and tracing
- health/readiness endpoints

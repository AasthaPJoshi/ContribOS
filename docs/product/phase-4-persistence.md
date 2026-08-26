# Phase 4: Persistence Layer

## Goal

Move ContribOS from process-local state to durable PostgreSQL persistence while preserving idempotency, evidence provenance, reconciliation history, and deterministic state transitions.

## Completed capabilities

- dedicated `@contribos/db` package
- PostgreSQL schema using Drizzle ORM
- generated and reviewable SQL migrations
- installation persistence
- repository persistence
- contribution persistence
- evidence persistence
- state-evaluation persistence
- reconciliation-run persistence
- state-history persistence
- durable webhook delivery claims
- webhook delivery lifecycle states
- processed and failed delivery handling
- stale-claim recovery
- atomic reconciliation persistence transaction
- foreign-key ownership boundaries
- unique GitHub identity constraints
- migration and database constraint tests
- repository lifecycle integration tests
- database error classification
- production connection-pool lifecycle
- explicit close/shutdown capability

## Atomic reconciliation transaction

A successful authoritative reconciliation can now persist, inside one database transaction:

1. contribution snapshot and current head SHA
2. normalized evidence
3. reconciliation-run record
4. state evaluation
5. state-history transition

This prevents partial persistence where the contribution state changes without its evidence or evaluation history.

## Durable webhook lifecycle

Webhook deliveries use a unique GitHub delivery ID.

Lifecycle:

- `CLAIMED`
- `PROCESSED`
- `FAILED`

Claims are created using a unique database insert, so concurrent workers cannot both claim the same delivery.

Claims that remain unfinished beyond an operational threshold can be marked failed with `STALE_CLAIM` for later retry/recovery workflows.

## Error classification

Known PostgreSQL error classes are separated into retryable and non-retryable categories.

Examples:

- uniqueness conflict: non-retryable
- foreign-key violation: non-retryable
- serialization failure: retryable
- deadlock: retryable
- connection/resource transient failures: retryable

## Connection lifecycle

Production PostgreSQL access uses a bounded connection pool with explicit shutdown through the database handle's `close()` method.

## Phase 4 boundary

Phase 4 establishes durable persistence and transaction semantics.

Later phases should add worker orchestration, retry scheduling, queue semantics, retention jobs, production observability, and real deployment database migrations.

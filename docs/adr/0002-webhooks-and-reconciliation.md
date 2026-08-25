# ADR 0002: Webhooks for Speed, Reconciliation for Correctness

## Status

Accepted

## Context

ContribOS depends on GitHub repository state to determine contribution workflow state, next actor, readiness, blockers, and impact.

GitHub webhooks provide low-latency event delivery, but webhook delivery alone is not sufficient as the sole source of truth because events can be delayed, duplicated, delivered out of order, or missed.

A production-grade system therefore needs both fast event ingestion and periodic correctness recovery.

## Decision

ContribOS will use:

- GitHub webhooks for low-latency updates
- queued asynchronous processing for webhook events
- idempotent event handling
- GitHub API reconciliation for authoritative state recovery
- deterministic state evaluation after normalization

Webhook payloads are treated as change notifications, not permanent canonical truth.

The reconciliation process will query GitHub for current repository state and repair local state when necessary.

## Processing Model

1. GitHub sends a webhook event.
2. ContribOS verifies the webhook signature.
3. The event is persisted or queued with its delivery identifier.
4. Duplicate deliveries are detected safely.
5. A worker normalizes relevant GitHub evidence.
6. The deterministic state engine evaluates the contribution.
7. State and supporting evidence are persisted.
8. Reconciliation periodically re-fetches authoritative GitHub state.
9. Any detected drift is corrected and re-evaluated.

## Consequences

### Positive

- low-latency updates
- resilience to missed webhook deliveries
- recovery from out-of-order events
- deterministic replay
- easier debugging and observability
- stronger eventual consistency

### Tradeoffs

- more infrastructure than webhook-only processing
- reconciliation creates additional GitHub API traffic
- idempotency and ordering must be designed explicitly
- state freshness and API rate limits must be monitored

## Reliability Requirements

Webhook processing should eventually support:

- signature verification
- delivery ID deduplication
- retry-safe handlers
- dead-letter handling
- event timestamps
- installation and repository scoping
- observability across ingestion and evaluation
- reconciliation checkpoints
- GitHub API rate-limit awareness

## Principle

Webhooks optimize for speed.

Reconciliation protects correctness.

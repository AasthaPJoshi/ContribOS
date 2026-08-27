# Phase 7: Product Query API

## Part 1: Core Query Layer

This part introduces the read-side API used by future HTTP endpoints and product surfaces.

Initial product queries:

- repository overview
- contribution details
- current deterministic workflow state
- next actor
- readiness
- reason code
- contribution state history
- evidence history
- reconciliation history

The query layer reads existing deterministic state and evidence. It does not re-run reconciliation or make AI-derived decisions.

Part 2 will build the Maintainer Attention Queue on top of these read models.

## Part 2: Maintainer Attention Queue

The attention queue is deterministic and derived from the latest stored state evaluation.

Initial priority signals:

- ambiguous workflow state
- ready to merge
- maintainer is the next actor
- ready for review or re-review
- in review
- unknown next actor
- ambiguous readiness

Terminal contributions are excluded.

Tie breaking is deterministic:

1. priority score descending
2. oldest contribution update first
3. repository full name
4. pull request number

The queue supports:

- workflow-state filtering
- readiness filtering
- next-actor filtering
- page/page-size pagination

No AI model participates in ranking.

## Part 3: Evidence and State History API

The decision trail exposes the minimum structured data needed to explain why a contribution is in its current state.

It includes:

- ordered workflow state transitions
- reason codes for each transition
- normalized GitHub evidence references
- reconciliation status and repair metadata
- head SHA and drift fields for reconciliation runs

The product-facing trail intentionally does not expose raw evidence payloads or full reconciliation result blobs.

This keeps the API auditable while reducing accidental leakage of unnecessary source data.

## Part 4: Repository Dashboard API

The repository dashboard provides maintainers with a deterministic operational snapshot.

It summarizes:

- total, active, and terminal contributions
- ambiguous and blocked contributions
- review-ready, re-review-ready, merge-ready, and release-ready counts
- next-action ownership by maintainer, author, CI, or unknown
- counts by workflow state
- counts by readiness
- counts by next actor
- highest observed pull request number
- oldest reconciliation timestamp

The dashboard is derived entirely from stored ContribOS state and does not introduce additional decision logic.

## Part 5: Product HTTP API

The product query layer is exposed through read-only HTTP endpoints:

- `GET /api/repositories/:githubRepositoryId`
- `GET /api/repositories/:githubRepositoryId/dashboard`
- `GET /api/repositories/:githubRepositoryId/attention`
- `GET /api/repositories/:githubRepositoryId/contributions/:pullRequestNumber`
- `GET /api/repositories/:githubRepositoryId/contributions/:pullRequestNumber/decision-trail`

Attention queue query parameters:

- `page`
- `pageSize`
- `workflowState`
- `readiness`
- `nextActor`

Decision trail query parameters:

- `limit`

Identifiers, pagination, and limits are validated before reaching the query layer.

The API returns `200` for successful reads, `400` for invalid input, `404` for unknown resources, and uses the existing HTTP error boundary for unexpected failures.

These endpoints are read-only and preserve the deterministic state engine as the source of workflow truth.

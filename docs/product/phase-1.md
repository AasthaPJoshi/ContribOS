# Phase 1: Core and GitHub Ingestion Foundation

## Goal

Create a deterministic, testable GitHub ingestion boundary that can safely accept supported GitHub webhook events and normalize them into evidence-ready internal events.

## Completed capabilities

- deterministic contribution state model
- deterministic pull request state engine
- evidence propagation through state evaluation
- GitHub pull request normalization boundary
- GitHub evidence references
- webhook envelope model
- HMAC webhook signature verification
- delivery ID deduplication
- atomic delivery claiming
- required delivery, event, installation, and repository validation
- supported webhook event validation
- supported webhook action validation
- authenticated webhook ingestion boundary
- typed webhook action extraction
- normalized pull request events
- normalized pull request review events
- normalized check run events
- normalized check suite events
- normalized workflow run events
- evidence creation from normalized webhook events
- monorepo dependency-aware test, typecheck, and build ordering

## Phase 1 boundary

Phase 1 does not yet implement:

- GitHub App JWT and installation token exchange
- live GitHub API reconciliation
- PostgreSQL persistence
- Redis or BullMQ workers
- production deployment
- user interface

Those capabilities belong to later phases.

## Verification

Run:

    pnpm verify

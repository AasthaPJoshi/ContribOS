# Phase 3: GitHub Reconciliation Engine

## Goal

Rebuild ContribOS contribution state from authoritative GitHub API data so webhooks provide speed while reconciliation restores correctness.

## Completed capabilities

- authoritative pull request refresh
- bounded mergeability polling with exponential backoff
- current head SHA capture
- final head SHA revalidation after dependent API reads
- race detection when a pull request changes during reconciliation
- paginated review retrieval
- paginated check-run retrieval
- paginated legacy commit-status retrieval
- active branch-rule retrieval
- repository and organization ruleset awareness through GitHub's active rules-for-branch endpoint
- required approving-review count awareness
- stale approval handling when rules dismiss approvals after a push
- required status-check awareness
- required check integration-ID matching
- legacy commit-status support
- fail-closed handling for missing required checks
- pull request, review, check-run, and commit-status evidence
- webhook-versus-authoritative snapshot drift detection
- explicit repair decisions
- authoritative baseline creation
- no-op decisions when state already matches
- deferred repair when reconciliation is unstable
- fail-closed policy handling when additional evidence is required

## Reconciliation flow

1. Validate installation, repository, and pull request identifiers.
2. Fetch the current pull request.
3. Poll boundedly if GitHub has not yet computed mergeability.
4. Capture the head SHA and target branch.
5. Fetch active rules for the target branch.
6. Fetch all review pages.
7. Fetch all check-run pages for the captured head SHA.
8. Fetch all legacy commit-status pages for the captured head SHA.
9. Derive review and check readiness from active policy.
10. Re-fetch the pull request.
11. Reject the reconciliation result if the head SHA changed.
12. Build normalized evidence and a domain snapshot.
13. Compare it with webhook-derived state when available.
14. Emit a deterministic repair decision.

## Safety behavior

ContribOS does not claim merge readiness when it cannot prove it.

A reconciliation is deferred when:

- GitHub mergeability remains unknown
- the head SHA changes while reconciliation is running
- pagination exceeds the configured safety limit
- policy requires evidence that is not yet modeled safely

Current policy features that deliberately fail closed include:

- required code-owner review
- required last-push approval
- required review-thread resolution

These states produce `POLICY_UNRESOLVED` rather than an incorrect ready-to-merge result.

## Phase 3 boundary

Phase 3 establishes an authoritative, race-aware reconciliation and repair layer.

Later phases will persist these results, schedule reconciliation jobs, and apply repair decisions through durable workers.

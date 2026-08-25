# ADR 0004: Evidence Provenance for Every State Evaluation

## Status

Accepted

## Context

ContribOS makes operational decisions about pull requests, including workflow state, next actor, readiness, blockers, and ambiguity.

For maintainers to trust these decisions, every evaluation must be explainable and traceable back to concrete GitHub evidence.

Returning only a state such as `READY_TO_MERGE` or `CHANGES_REQUESTED` is insufficient for debugging, auditability, replay, and user trust.

## Decision

Every deterministic state evaluation will carry explicit evidence references describing the GitHub objects that contributed to the decision.

The canonical evaluation model includes:

- workflow state
- next actor
- readiness
- reason code
- explanation
- evidence references
- evaluation timestamp
- engine version

Evidence references will identify the originating GitHub object and include enough information to trace the decision back to its source.

## Evidence Model

An evidence reference should include:

- internal evidence identifier
- source system
- object type
- external object identifier
- GitHub URL
- occurrence timestamp

Initial GitHub evidence object types include:

- pull requests
- issues
- reviews
- review threads
- check runs
- check suites
- workflow runs
- commits
- releases
- repositories

## Processing Principle

Normalized repository state is used for deterministic evaluation.

The resulting evaluation stores the evidence references that justify the matched rule.

For example, a `READY_TO_MERGE` evaluation may reference:

- the current pull request
- the latest approved review
- successful required checks
- the current head commit

## Correctness Requirements

Evidence used for evaluation must eventually be tied to the current contribution state.

In particular:

- reviews must be interpreted against the relevant pull request state
- CI results must correspond to the current head commit where applicable
- stale checks must not make a newer commit appear ready
- superseded reviews must not be treated as current approval
- missing evidence must produce ambiguity rather than fabricated certainty

## Consequences

### Positive

- explainable decisions
- auditable state evaluations
- easier debugging
- deterministic replay
- user-visible trust signals
- stronger incident investigation
- foundation for Impact Trail

### Tradeoffs

- more data must be stored
- evidence normalization becomes more important
- stale and superseded evidence must be modeled explicitly
- GitHub object relationships must be preserved accurately

## AI Boundary

AI may explain or summarize evidence.

AI may not invent evidence or override deterministic evidence-backed state.

## Principle

Every important ContribOS decision should answer two questions:

1. What did ContribOS decide?
2. What evidence caused that decision?

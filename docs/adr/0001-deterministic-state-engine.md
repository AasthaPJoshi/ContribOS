# ADR 0001: Deterministic Contribution State Engine

## Status

Accepted

## Context

ContribOS must determine contribution workflow state, next actor, readiness, blockers, and ambiguity from repository evidence.

These decisions affect maintainers and contributors directly, so canonical workflow state must be explainable, reproducible, and testable.

## Decision

ContribOS will use a deterministic state engine for canonical contribution state.

The engine separates state into three dimensions:

- `WorkflowState`
- `NextActor`
- `Readiness`

Rules are evaluated from normalized repository evidence.

Each evaluation returns:

- workflow state
- next actor
- readiness
- reason code
- explanation
- supporting evidence
- evaluation timestamp
- engine version

When evidence is unknown, contradictory, or insufficient, the engine returns an explicit ambiguous state rather than guessing.

AI may later summarize, explain, prioritize, or assist with handoffs, but AI will not determine canonical workflow state.

## Consequences

### Positive

- reproducible decisions
- auditable state transitions
- deterministic tests
- explainable output
- safer handling of incomplete evidence
- independent AI assistance layer

### Tradeoffs

- rule precedence must be maintained carefully
- GitHub evidence must be normalized accurately
- edge cases require explicit modeling
- rule versions must remain traceable as behavior evolves

## Initial Scope

The first implementation evaluates pull requests using deterministic signals such as:

- open, closed, draft, and merged state
- CI status
- review decision
- outstanding author changes
- maintainer review requirement
- merge conflicts

Future versions will attach concrete GitHub evidence references to every evaluation.

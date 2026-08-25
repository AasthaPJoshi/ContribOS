# ContribOS

ContribOS is a GitHub-native contribution operations and trust layer for maintainers and contributors.

It determines, from deterministic repository evidence:

- what needs attention next
- who owns the next action
- why a contribution is blocked
- whether a contribution is ready for review
- whether it is ready to merge or release
- whether the available evidence is incomplete or inconsistent

## Core principle

ContribOS separates contribution state into three dimensions:

- `WorkflowState`
- `NextActor`
- `Readiness`

Deterministic GitHub evidence determines canonical state. AI may later explain, summarize, or assist, but it does not decide source-of-truth workflow state.

## Current packages

- `@contribos/domain` - shared domain models and contracts
- `@contribos/state-engine` - deterministic pull request evaluation engine

## Development

Install dependencies:

    pnpm install

Run tests:

    pnpm test

Run type checking:

    pnpm typecheck

Build all packages:

    pnpm build

## Current status

The initial deterministic pull request state engine covers:

- merged pull requests
- closed pull requests
- draft pull requests
- CI failures
- pending CI
- unknown CI state
- changes requested
- merge conflicts
- maintainer review readiness
- ready-to-merge state
- inconsistent review evidence
- ambiguous fallback states

## License

Apache-2.0

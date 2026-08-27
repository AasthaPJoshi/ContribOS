# Phase 8: Maintainer UI

## Part 1: Frontend foundation

Phase 8 introduces the first maintainer-facing ContribOS application.

The frontend is a React + Vite application under `apps/web`.

Part 1 establishes:

- workspace-integrated frontend package
- browser routing
- product API client
- product-facing TypeScript contracts
- shared application shell
- loading, error, and empty-state components
- repository entry route
- Vite development proxy to the control plane
- API client tests
- production build integration through Turbo

The UI consumes the read-only product API created in Phase 7. Deterministic backend state remains the source of truth.

Planned next parts:

1. Repository Dashboard
2. Maintainer Attention Queue
3. Contribution Detail and Decision Trail
4. UX hardening, accessibility, integration tests, and final Phase 8 verification

## Part 2: Repository Dashboard

The repository route now consumes both the repository overview and dashboard endpoints.

The maintainer dashboard surfaces:

- active contribution count
- maintainer-action count
- ready-to-merge count
- blocked contribution count
- ambiguous contribution count
- ready-for-release count
- workflow-state distribution
- readiness distribution
- next-actor distribution
- recent pull requests with deterministic state, ownership, readiness, and reason code
- direct navigation to the future attention queue and contribution detail surfaces

Presentation logic is kept separate from API retrieval through a small deterministic dashboard view-model module.

## Part 3: Maintainer Attention Queue

The maintainer attention route consumes the Phase 7 attention API and presents its deterministic ranking directly.

The queue includes:

- priority band and score
- pull request navigation
- workflow state
- next actor
- readiness
- deterministic priority reasons
- GitHub link
- workflow/readiness/next-actor filters
- pagination
- empty, loading, and failure states
- visible-page priority summary

The frontend does not calculate workflow truth or alter ranking logic.

## Part 4: Contribution Detail and Decision Trail

The contribution detail route combines the current-state endpoint with the safe decision-trail endpoint.

The page surfaces:

- deterministic workflow state
- next actor
- readiness
- reason code
- state explanation
- state-transition history
- GitHub evidence references
- reconciliation runs
- drift counts
- repair actions
- direct PR navigation
- navigation back to repository dashboard and maintainer attention queue

Raw evidence payloads and raw reconciliation result blobs are not exposed by this UI.

## Part 5: Hardening and Phase Completion

Phase 8 adds the first maintainer-facing ContribOS product surface.

Hardening completed in this part:

- unknown-route fallback
- keyboard focus visibility
- responsive behavior down to narrow mobile layouts
- reduced-motion support
- application metadata
- frontend-to-backend route contract tests
- full monorepo verification

### Security and deployment boundary

The current product API introduced in Phase 7 does not yet implement end-user authentication or authorization.

Therefore, the Phase 8 web application must be treated as a local-development or trusted-network maintainer console until a real user/session authorization boundary is implemented.

Do not expose the current product API or this UI directly to the public internet for private-repository data.

The Vite development proxy is intended for local development. Production deployment should place both the web surface and product API behind an authenticated trusted boundary.

### Phase 8 completion criteria

Phase 8 is complete when:

1. repository dashboard is usable
2. maintainer attention queue is usable
3. contribution detail and safe decision trail are usable
4. loading, empty, failure, and unknown-route states are handled
5. frontend API calls match the Phase 7 HTTP routes
6. frontend tests, typecheck, production build, and full `pnpm verify` pass

This phase does not claim production readiness. Authentication, authorization, deployment topology, live GitHub dogfooding, and deeper end-to-end browser testing remain later hardening work.

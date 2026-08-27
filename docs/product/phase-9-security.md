# Phase 9: Authentication, Authorization, and Production Boundary

## Goal

Phase 9 introduces the user-security boundary that must exist before ContribOS can safely expose private-repository product data outside a trusted development environment.

The security model must remain server-authoritative and fail closed.

## Core decisions

### 1. GitHub is the initial identity provider

ContribOS will authenticate users through GitHub.

The browser must never receive or retain GitHub App private keys, installation tokens, or server-side OAuth secrets.

### 2. Browser sessions are opaque

After successful GitHub authentication, ContribOS will issue a cryptographically random opaque session token.

Only the token hash should be stored server-side.

The raw session token belongs only in an HttpOnly browser cookie.

This avoids using a browser-visible JWT as the primary authorization source and preserves server-side revocation.

### 3. Repository authorization is separate from authentication

A valid ContribOS session proves who the user is.

It does not prove which repositories the user may access.

Every product API request that addresses repository data must resolve repository authorization independently and fail closed when access cannot be proven.

### 4. Authorization must be installation-aware

Repository access must be tied to the GitHub App installation and repository scope known to ContribOS.

A repository ID supplied by the browser is never itself proof of access.

### 5. Product APIs require authenticated sessions

Current Phase 7 product endpoints under `/api/*` are classified as authenticated product APIs.

Phase 9 will enforce this classification once session persistence and GitHub sign-in are wired.

Health endpoints remain minimally public.

GitHub webhooks continue to use their dedicated HMAC signature authentication and are not authenticated with user sessions.

### 6. Access is hierarchical

The initial repository access model is:

`READ < MAINTAIN < ADMIN`

Product queries initially require `READ`.

Future state-changing maintainer operations can require stronger access.

### 7. Session cookie policy

The intended production cookie policy is:

- HttpOnly
- Secure in production
- SameSite=Lax
- Path=/
- bounded lifetime
- server-side expiration and revocation

Local HTTP development may omit `Secure`, but production must not.

### 8. CSRF boundary

The current product API is read-only.

Before state-changing browser endpoints are added, ContribOS must add explicit CSRF protection and same-origin validation rather than relying on SameSite behavior alone.

### 9. Security headers

API responses should use conservative defaults including:

- `Cache-Control: no-store`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy`

Content Security Policy belongs with the final production web-serving topology.

## Part 1 implemented

Phase 9 Part 1 establishes:

- authenticated-principal contracts
- repository access-level contracts
- fail-closed repository access policy
- opaque session-token generation
- SHA-256 session-token hashing
- session-cookie parsing and serialization
- request-security classification
- conservative security-header primitives
- unit tests for each security primitive

These foundations are intentionally not wired into the live product API yet.

Enforcement must not be enabled until GitHub authentication, durable session persistence, and repository authorization resolution exist.

## Planned remaining parts

### Part 2: GitHub OAuth and durable sessions

- OAuth state protection
- callback flow
- GitHub identity resolution
- session database table
- session issue, lookup, revoke, expire
- sign-in and sign-out HTTP endpoints

### Part 3: Repository authorization

- installation-aware repository access resolution
- GitHub permission mapping
- authorization cache/persistence where appropriate
- private-repository isolation tests

### Part 4: Enforcement and frontend session UX

- protect `/api/*`
- current-user endpoint
- frontend authenticated-route behavior
- sign-in/sign-out UI
- 401 vs 403 behavior
- fail-closed integration tests

### Part 5: Security hardening and phase completion

- CSRF/same-origin defenses for mutation-ready architecture
- security headers wired into HTTP responses
- session expiration/revocation hardening
- deployment configuration
- end-to-end security tests
- full verification and commit

## Production-readiness statement

ContribOS is still not production-ready after Part 1.

The unauthenticated Phase 7 product API remains a known blocker until the later Phase 9 enforcement parts are complete.

## Part 2 implemented: GitHub OAuth and durable sessions

Part 2 adds the server-side identity and session infrastructure needed before authentication enforcement.

### Durable identity data

The database now stores:

- GitHub identity provider and provider user ID
- current GitHub login and avatar URL
- encrypted GitHub App user access token
- encrypted refresh token when GitHub supplies one
- token expiration timestamps when supplied

GitHub credentials are encrypted with AES-256-GCM before persistence.

The credential encryption key is provided separately through `CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY` and must decode from base64 to exactly 32 bytes.

### Durable browser sessions

The database now stores:

- opaque session token hash
- authenticated user ownership
- expiration
- revocation time
- last-seen time

Only a SHA-256 hash of the browser session token is persisted.

The raw browser token remains in the HttpOnly session cookie.

### OAuth state

OAuth state is:

- generated cryptographically
- persisted only as a hash
- bounded by expiration
- atomically consumed once
- mirrored in a short-lived HttpOnly cookie
- compared in constant time before token exchange

This protects the login callback from login CSRF and replay.

### GitHub App user flow

ContribOS uses the GitHub App web application user-authorization flow.

The server:

1. creates durable single-use OAuth state
2. redirects to GitHub authorization
3. receives the callback code and state
4. validates cookie state and consumes durable state
5. exchanges the code server-side
6. reads the authenticated GitHub user
7. encrypts the GitHub user token before persistence
8. creates a revocable opaque ContribOS session

No GitHub user access token is returned to browser JavaScript.

### New auth configuration

Part 2 introduces a separate auth configuration loader requiring:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `CONTRIBOS_PUBLIC_BASE_URL`
- `CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY`

Optional controls:

- `CONTRIBOS_SESSION_TTL_SECONDS`
- `CONTRIBOS_OAUTH_STATE_TTL_SECONDS`

`CONTRIBOS_PUBLIC_BASE_URL` must use HTTPS outside loopback development.

### Enforcement status

The OAuth client, durable stores, and authentication service exist, but HTTP login routes and `/api/*` enforcement remain intentionally unwired.

Part 3 will use the encrypted GitHub App user access token to resolve installations and repositories explicitly accessible to the authenticated user.

## Part 3 implemented: Installation-aware repository authorization

Part 3 establishes the authorization decision between a valid ContribOS session and repository product data.

### Authorization source of truth

ContribOS does not authorize a repository merely because its numeric repository ID exists in the local database.

For each authorization decision, the server verifies:

1. the repository is known locally
2. the repository belongs to a specific GitHub App installation known locally
3. the authenticated GitHub App user access token can access that installation
4. the same user token can access the target repository through that installation
5. GitHub returns explicit repository permission evidence
6. that permission meets the ContribOS access level required by the operation

If any proof is missing, ContribOS fails closed.

### GitHub user-access endpoints

The authorization client uses:

- `GET /user/installations`
- `GET /user/installations/{installation_id}/repositories`

These endpoints are intended for GitHub App user access tokens.

The repository response carries the authenticated user's repository permission evidence.

### ContribOS permission mapping

Initial mapping:

- GitHub `admin` -> ContribOS `ADMIN`
- GitHub `maintain` or `push` -> ContribOS `MAINTAIN`
- GitHub `triage` or `pull` -> ContribOS `READ`
- no explicit permission -> denied

The mapping is deliberately conservative and can later be refined for GitHub custom repository roles.

### Server-only session context

`AuthService` can now resolve an internal authorization context containing:

- ContribOS session ID
- ContribOS user ID
- authenticated GitHub principal
- encrypted GitHub user access token
- GitHub user access token expiration

This structure is server-only and must never be serialized to the browser.

### Token expiration

If the persisted GitHub user access token is expired or GitHub rejects it as invalid, repository authorization returns `REAUTHENTICATION_REQUIRED`.

Refresh-token rotation is intentionally deferred to Phase 9 hardening.

### Performance note

Part 3 performs live GitHub authorization checks and intentionally does not add a stale authorization cache yet.

This favors correctness while the security boundary is being established.

### Enforcement status

The repository authorization service now exists, but `/api/*` is still not protected.

Part 4 will wire:

- OAuth login and callback HTTP routes
- session-cookie resolution
- repository authorization into repository product routes
- current-user/session endpoint
- frontend sign-in and sign-out behavior
- explicit 401 and 403 responses

## Part 4 implemented: HTTP enforcement and authenticated web UX

Part 4 activates the Phase 9 security boundary.

### Authentication routes

The control plane now exposes:

- `GET /auth/github/login`
- `GET /auth/github/callback`
- `POST /auth/logout`
- `GET /api/auth/me`

The login route creates durable OAuth state and redirects to GitHub.

The callback validates both the short-lived OAuth state cookie and the durable single-use state record before creating a ContribOS session.

The browser receives only the opaque HttpOnly ContribOS session cookie.

### Product API enforcement

Every `GET /api/*` request now requires a valid ContribOS session.

Repository product routes receive a second authorization gate.

For `/api/repositories/{githubRepositoryId}...`, the server verifies installation-aware repository access before dispatching the request to the Phase 7 query API.

Current read-only product routes require ContribOS `READ`.

### Failure semantics

- missing or invalid ContribOS session -> `401 UNAUTHENTICATED`
- expired or rejected GitHub user token -> `401 REAUTHENTICATION_REQUIRED`
- authenticated user without repository access -> `403 REPOSITORY_NOT_AUTHORIZED`
- authenticated user below required level -> `403 INSUFFICIENT_ACCESS`
- cross-origin logout -> `403 ORIGIN_NOT_ALLOWED`

### Public routes

The following remain outside the user-session boundary:

- `/live`
- `/ready`
- `/auth/github/login`
- `/auth/github/callback`
- `/webhooks/github`

GitHub webhooks continue to rely on their dedicated HMAC signature boundary rather than browser authentication.

### Logout request origin

Logout is a state-changing browser request.

Part 4 requires the `Origin` header to match `CONTRIBOS_PUBLIC_BASE_URL` before revoking the session.

This establishes the same-origin pattern that future state-changing product endpoints will extend with explicit CSRF controls.

### Web frontend

The React frontend now:

- resolves the current user from `/api/auth/me`
- displays authenticated and anonymous session states
- redirects users into GitHub sign-in
- supports server-side session logout
- protects repository dashboard, attention, and contribution routes
- keeps the home route public
- explains that repository access is independently verified after authentication

The Vite development server proxies both `/api` and `/auth` to the control plane.

For local development, `CONTRIBOS_PUBLIC_BASE_URL` should therefore be the browser-facing Vite origin, normally `http://localhost:5173`.

### Environment variable normalization

The canonical GitHub App user authorization variables are now:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

The temporary `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` names remain accepted for compatibility, but new environments should use the canonical names.

### Remaining hardening

Part 5 will complete Phase 9 with:

- stricter session lifecycle behavior
- refresh-token rotation
- auth database migration regression tests
- webhook signature-before-JSON-processing review
- HTTP content-type and response-header hardening
- authorization failure privacy review
- deployment boundary documentation
- final full verification and commit

## Part 5 implemented: Security hardening and release boundary

Part 5 closes the Phase 9 authentication and authorization work.

### Private repository existence protection

A signed-in user who cannot prove access to a repository receives a generic `404 NOT_FOUND`.

This prevents the repository authorization layer from confirming whether a private repository exists in the ContribOS database.

`INSUFFICIENT_ACCESS` remains a `403` when an already-authorized repository operation explicitly requires a higher ContribOS role.

### Webhook media type and signature boundary

`POST /webhooks/github` now requires `Content-Type: application/json`.

Unsupported media types are rejected with `415 UNSUPPORTED_MEDIA_TYPE` before the webhook application service is invoked.

The GitHub ingestion package remains responsible for HMAC verification against the exact raw request body.

A regression test protects the invariant that signature verification stays at the ingestion boundary before payload interpretation.

### Auth persistence regression coverage

Database migration tests now explicitly verify:

- `auth_users`
- `auth_sessions`
- `oauth_states`
- uniqueness of GitHub provider identity
- uniqueness of session-token hashes
- uniqueness of OAuth-state hashes

### API contract drift fix

The Phase 8 frontend attention-queue model is aligned with the backend contract.

`contributionId` is now used as the attention-item identity instead of the stale `id` assumption.

### Session and token lifecycle

Phase 9 intentionally keeps the following conservative behavior:

- ContribOS browser sessions are durable, opaque, revocable, and time bounded.
- Expired or rejected GitHub user access tokens require reauthentication.
- GitHub refresh tokens are stored encrypted when supplied.
- Automatic refresh-token rotation is not enabled yet.

Automatic token refresh is deferred because it requires atomic replacement of access and refresh credentials, failure recovery, and concurrency control around simultaneous refresh attempts. Reauthentication is the fail-closed behavior for this phase.

### Deployment boundary

Production requirements:

- HTTPS is mandatory.
- `CONTRIBOS_PUBLIC_BASE_URL` must be the externally visible browser origin.
- Session cookies use `Secure` automatically on HTTPS.
- API and frontend should be served as a same-origin application or behind a trusted reverse proxy that preserves the configured public origin.
- GitHub App private key, OAuth client secret, webhook secret, database credentials, and the credential-encryption key must come from a protected secret store.
- Database migrations must run as a deployment step before the new application version starts.
- `/webhooks/github` must be reachable by GitHub but remains protected by GitHub HMAC verification.
- `/api/*` must never be exposed through a bypass path that skips the control-plane authentication layer.
- `/live` is intentionally minimal and may be public.
- `/ready` should be restricted at the infrastructure layer if it later exposes dependency details.

### Remaining work outside Phase 9

Phase 9 establishes the authentication and repository-authorization boundary, but it does not make the entire ContribOS system production complete.

Remaining platform work includes:

- live GitHub App dogfooding
- installation and repository lifecycle synchronization
- failed webhook delivery retry semantics
- transactional outbox or equivalent webhook enqueue durability
- reconciliation atomicity improvements
- worker shutdown draining
- scheduler overlap prevention
- reconciliation semantic hardening
- production deployment and observability validation
- browser end-to-end testing against a real GitHub App

## Phase 9 completion criteria

Phase 9 is complete when:

- authentication primitives are tested
- GitHub user authorization is server-side
- browser sessions are opaque and durable
- GitHub user credentials are encrypted at rest
- OAuth state is durable and single use
- every product API requires authentication
- every repository API independently proves repository access
- private repository existence is not leaked to unauthorized users
- frontend repository routes require authentication
- logout is same-origin protected
- auth schema migrations have regression coverage
- the full monorepo verify command passes

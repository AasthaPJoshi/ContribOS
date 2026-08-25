# ADR 0003: GitHub App Authentication

## Status

Accepted

## Context

ContribOS needs secure access to repository metadata, pull requests, reviews, checks, workflows, commits, releases, and webhook events across multiple repositories and organizations.

Using personal access tokens would tightly couple access to an individual user, create unnecessary credential risk, and make installation-level authorization harder to manage.

ContribOS needs an authentication model that supports least privilege, repository scoping, organization installation, webhook delivery, token rotation, and auditable access.

## Decision

ContribOS will integrate with GitHub using a GitHub App.

The GitHub App will be the primary authentication and authorization boundary for repository access.

ContribOS will use:

- GitHub App credentials for application identity
- installation access tokens for repository API access
- webhook secrets for payload verification
- least-privilege permissions
- installation and repository identifiers for tenant scoping

Personal access tokens will not be used as the primary production authentication model.

## Authentication Flow

1. A repository or organization installs the ContribOS GitHub App.
2. GitHub assigns an installation identifier.
3. ContribOS creates a signed JSON Web Token using the GitHub App private key.
4. ContribOS exchanges the app token for a short-lived installation access token.
5. The installation token is used for authorized GitHub API operations.
6. Repository access remains limited to the installation scope and configured permissions.

## Security Requirements

The implementation must support:

- least-privilege GitHub permissions
- secure private-key storage
- webhook signature verification
- installation-level tenant isolation
- short-lived installation tokens
- no secrets in source control
- secret rotation
- auditable authentication failures
- repository access validation before processing events

## Initial Permission Philosophy

Permissions should be added only when required by a concrete product capability.

The initial implementation should prefer read-only access wherever possible.

Likely capability areas include:

- pull requests
- issues
- checks
- actions or workflow metadata
- repository metadata
- commits
- releases

Exact permissions will be finalized when the GitHub integration package is implemented.

## Consequences

### Positive

- installation-scoped access
- stronger least-privilege model
- short-lived API credentials
- organization-friendly deployment
- native webhook integration
- easier multi-repository support
- reduced dependence on individual user credentials

### Tradeoffs

- GitHub App setup is more complex than using a personal token
- installation token generation must be implemented
- private-key handling becomes security-critical
- permissions must be managed carefully as capabilities expand

## Principle

ContribOS should access GitHub as an installed application, not as an individual developer.

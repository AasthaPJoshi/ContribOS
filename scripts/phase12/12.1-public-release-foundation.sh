#!/usr/bin/env bash
set -euo pipefail

echo "== ContribOS Phase 12.1: public release foundation =="

mkdir -p .github/ISSUE_TEMPLATE docs/release scripts/phase12

cat > LICENSE <<'EOF'
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
EOF

cat > README.md <<'EOF'
# ContribOS

**ContribOS is a GitHub-native contribution operations and trust layer for maintainers and contributors.**

It turns repository evidence into a deterministic answer to the questions that slow contribution workflows down:

- What needs attention next?
- Who owns the next action?
- Why is this contribution blocked?
- Is it ready for review?
- Is it ready to merge?
- Is it ready for release?
- Is the available evidence incomplete or contradictory?

## Why ContribOS

GitHub already stores the evidence, but teams still have to manually interpret reviews, checks, mergeability, repository policy, stale state, and ownership.

ContribOS builds a deterministic control plane over that evidence.

The core rule is simple:

> **GitHub evidence determines canonical workflow state. AI may explain or summarize that state, but AI does not decide it.**

## Core model

ContribOS evaluates contribution state across three dimensions:

- `WorkflowState`
- `NextActor`
- `Readiness`

When evidence is unavailable or inconsistent, ContribOS prefers `UNKNOWN` or `AMBIGUOUS` over inventing certainty.

## Current v0.1 architecture

```text
GitHub App
   |
   +--> Webhooks --------+
   |                     |
   +--> GitHub API       |
                         v
                 Control Plane
                         |
             +-----------+-----------+
             |                       |
             v                       v
        Durable Worker        Reconciliation
             |                       |
             +-----------+-----------+
                         |
                         v
                  PostgreSQL
                         |
                         v
              Deterministic State
                         |
                         v
                 Product Query API
                         |
                         v
                    Web UI
```

The v0.1 production candidate includes:

- GitHub App authentication
- signed webhook verification
- webhook idempotency and retry recovery
- GitHub API reconciliation
- durable PostgreSQL persistence
- deterministic contribution-state evaluation
- worker orchestration
- repository authorization
- GitHub OAuth user authentication
- encrypted user credentials
- maintainer attention queue
- contribution decision trail
- repository dashboard
- readiness and liveness probes
- structured request observability
- graceful shutdown
- production Docker build
- production configuration and security verification gates

## Packages

- `@contribos/domain` - shared domain contracts
- `@contribos/state-engine` - deterministic contribution evaluation
- `@contribos/github` - GitHub App, API, webhook, evidence, and reconciliation logic
- `@contribos/db` - PostgreSQL schema, migrations, and repositories
- `@contribos/worker` - durable job execution and retry orchestration
- `@contribos/control-plane` - application runtime, auth, HTTP API, and product services
- `@contribos/web` - maintainer-facing web application

## Development

Requirements:

- Node.js 24
- pnpm 10
- PostgreSQL

Install dependencies:

```sh
pnpm install
```

Run the complete verification gate:

```sh
pnpm verify
```

That runs:

```text
tests -> typecheck -> production build
```

## Local configuration

Copy the environment template and configure local values:

```sh
cp .env.example .env.local
```

Never commit `.env.local`, `.secrets/`, GitHub private keys, OAuth secrets, webhook secrets, database credentials, or credential-encryption keys.

## Production verification

The v0.1 release candidate includes a repeatable production gate:

```sh
./scripts/ops/verify-production-readiness.sh
```

It verifies repository hygiene, high-confidence secret patterns, security controls, production configuration, targeted security tests, the full monorepo verification suite, and the Docker image when Docker is available.

See `docs/runbooks/` for deployment and operations guidance.

## Current release boundary

ContribOS v0.1 is designed as a **single-instance production candidate**.

Horizontal scaling requires additional distributed coordination for migration ownership, worker locking, sweep ownership, and related multi-replica behavior.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
EOF

cat > CONTRIBUTING.md <<'EOF'
# Contributing to ContribOS

Thanks for helping improve ContribOS.

## Development principles

ContribOS is built around a few non-negotiable rules:

1. deterministic GitHub evidence is canonical
2. uncertainty must remain visible
3. AI must not silently determine workflow state or ownership
4. security-sensitive behavior should fail closed
5. webhook speed must be paired with reconciliation for correctness
6. operational state that matters after restart belongs in durable storage

## Local setup

Requirements:

- Node.js 24
- pnpm 10
- PostgreSQL

Install dependencies:

```sh
pnpm install
```

Create local configuration:

```sh
cp .env.example .env.local
```

Do not commit local credentials or secret files.

## Verification

Before opening a pull request:

```sh
pnpm verify
```

For production/security-sensitive changes, also run:

```sh
./scripts/ops/verify-production-readiness.sh
```

## Pull requests

Keep pull requests focused.

A useful pull request should explain:

- the problem
- the chosen approach
- relevant design or security tradeoffs
- how the change was tested
- whether migrations or deployment behavior changed

Tests are expected for behavioral changes.

## Architecture changes

Material architecture decisions should be documented in `docs/adr/`.

Changes to deterministic state semantics should include tests showing both the intended state and conservative fallback behavior.

## Database migrations

Do not edit an already-applied migration.

Generate a new forward migration and review the SQL before committing it.

## Security

Do not open public issues containing credentials, private keys, access tokens, refresh tokens, webhook secrets, database credentials, or encryption keys.

See `SECURITY.md` for vulnerability reporting guidance.
EOF

cat > SECURITY.md <<'EOF'
# Security Policy

## Supported versions

Before the first stable release, security fixes are provided for the latest published ContribOS v0.1 release line only.

## Reporting a vulnerability

Please do not report suspected vulnerabilities in a public GitHub issue.

Use GitHub's private vulnerability reporting / Security Advisory workflow for this repository when available.

Include:

- affected component
- reproduction steps
- expected impact
- relevant logs with secrets removed
- whether the issue is remotely exploitable
- any known workaround

Do not include real credentials, GitHub tokens, private keys, webhook secrets, database passwords, session tokens, or credential-encryption keys in reports.

## Security model

ContribOS uses:

- GitHub App installation credentials for server-to-server GitHub access
- HMAC verification for GitHub webhooks
- opaque HttpOnly application sessions
- encrypted persisted GitHub user credentials
- repository-scope authorization
- conservative deterministic fallback when GitHub evidence is unavailable
- production security headers
- non-root container execution

Operational guidance is documented in `docs/runbooks/production-security.md`.
EOF

cat > CODE_OF_CONDUCT.md <<'EOF'
# Code of Conduct

## Our standard

ContribOS contributors are expected to communicate professionally, respectfully, and constructively.

Healthy participation includes:

- giving technical feedback about ideas rather than people
- assuming good intent while still reviewing critically
- being specific when identifying problems
- welcoming contributors with different experience levels
- respecting privacy and security boundaries
- accepting maintainer decisions about project scope

Unacceptable behavior includes harassment, discrimination, threats, deliberate disruption, doxxing, or publishing another person's private information without permission.

## Enforcement

Project maintainers may edit, hide, reject, or remove contributions or participation that violates this standard.

Serious or repeated violations may result in temporary or permanent exclusion from project spaces.

Security reports should follow `SECURITY.md`, not public conduct channels.
EOF

cat > CHANGELOG.md <<'EOF'
# Changelog

All notable ContribOS releases will be documented here.

The project follows semantic versioning once public versioned releases begin.

## [Unreleased]

### Added

- Public open-source release foundation.
- Contribution, security, conduct, and release documentation.

## [0.1.0] - Unreleased

### Added

- Deterministic pull request workflow state engine.
- GitHub App installation authentication and permission enforcement.
- Signed GitHub webhook ingestion with idempotency and retry recovery.
- GitHub API reconciliation.
- Durable PostgreSQL persistence and migrations.
- Durable worker orchestration and retry policy.
- Repository dashboards and maintainer attention queue.
- Contribution detail and decision trail.
- GitHub OAuth authentication and repository authorization.
- Encrypted GitHub user credential persistence and token refresh.
- Repository installation sync.
- Runtime health, readiness, structured request observability, and graceful shutdown.
- Production Docker build and deployment runbooks.
- Final production security and verification gate.

### Release boundary

v0.1.0 is a single-instance production candidate. Distributed multi-replica coordination is intentionally outside this release.
EOF

cat > .github/PULL_REQUEST_TEMPLATE.md <<'EOF'
## Problem

What problem does this change solve?

## Approach

How does the implementation solve it?

## Verification

What tests or verification did you run?

- [ ] `pnpm verify`
- [ ] Production verification run when security/deployment behavior changed
- [ ] Tests added or updated where behavior changed

## Risk / rollout

Does this change affect migrations, authentication, GitHub permissions, deterministic state evaluation, deployment, or recovery behavior?

## Evidence semantics

If this changes contribution state or readiness logic, explain how uncertainty and unavailable evidence are handled.
EOF

cat > .github/ISSUE_TEMPLATE/bug_report.yml <<'EOF'
name: Bug report
description: Report a reproducible ContribOS defect
title: "[Bug]: "
labels:
  - bug
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What happened?
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Reproduction
      description: Provide the minimum safe reproduction steps.
    validations:
      required: true
  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: ContribOS version, Node version, database version, and relevant deployment details.
  - type: checkboxes
    id: security
    attributes:
      label: Security check
      options:
        - label: I have removed credentials, tokens, private keys, secrets, and sensitive repository data.
          required: true
EOF

cat > .github/ISSUE_TEMPLATE/feature_request.yml <<'EOF'
name: Feature request
description: Propose a focused ContribOS improvement
title: "[Feature]: "
labels:
  - enhancement
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What contributor or maintainer problem should ContribOS solve?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposed behavior
    validations:
      required: true
  - type: textarea
    id: evidence
    attributes:
      label: Evidence and determinism
      description: What GitHub evidence should be canonical, and how should unavailable or conflicting evidence be handled?
  - type: textarea
    id: tradeoffs
    attributes:
      label: Tradeoffs
EOF

cat > .github/ISSUE_TEMPLATE/config.yml <<'EOF'
blank_issues_enabled: false
contact_links:
  - name: Security vulnerability
    url: https://github.com/AasthaPJoshi/ContribOS/security/advisories/new
    about: Report vulnerabilities privately instead of opening a public issue.
EOF

cat > docs/release/versioning.md <<'EOF'
# Versioning

ContribOS public releases use semantic versioning:

- MAJOR: incompatible public contract changes
- MINOR: backward-compatible product or API capability
- PATCH: backward-compatible fixes and hardening

The first planned public release is `v0.1.0`.

Before tagging a release:

1. update the repository/package version
2. finalize the matching changelog section
3. run `pnpm verify`
4. run `./scripts/ops/verify-production-readiness.sh`
5. verify the release commit has no local or secret files
6. create an annotated Git tag
7. push the release commit and tag only after review
EOF

cat > docs/release/v0.1-checklist.md <<'EOF'
# ContribOS v0.1.0 Release Checklist

## Repository

- [ ] public-facing README reviewed
- [ ] Apache-2.0 license present
- [ ] contribution guidance present
- [ ] security reporting guidance present
- [ ] code of conduct present
- [ ] issue and pull request templates present
- [ ] changelog finalized
- [ ] repository visibility intentionally reviewed
- [ ] GitHub App visibility intentionally reviewed

## Engineering

- [ ] `pnpm verify` passes
- [ ] production readiness verification passes
- [ ] Docker image builds
- [ ] database migrations reviewed
- [ ] no tracked local secrets
- [ ] clean Git working tree
- [ ] live GitHub dogfood path validated

## Release

- [ ] package versions changed to `0.1.0`
- [ ] changelog date finalized
- [ ] release commit reviewed
- [ ] annotated `v0.1.0` tag created
- [ ] GitHub release notes prepared
EOF

cat > docs/product/phase-12.1-release-foundation.md <<'EOF'
# Phase 12.1 - Public Release Foundation

Phase 12.1 establishes the open-source repository contract for the first ContribOS public release.

Delivered:

- complete public README
- Apache-2.0 license file
- contribution guide
- security policy
- project code of conduct
- changelog baseline
- issue templates
- pull request template
- semantic versioning policy
- v0.1 release checklist

Phase 12.1 does not create the v0.1.0 release tag.

Version finalization, release automation, live dogfood validation, and tagging remain later Phase 12 steps.
EOF

echo "== Phase 12.1 validation =="

test -s README.md
test -s LICENSE
test -s CONTRIBUTING.md
test -s SECURITY.md
test -s CODE_OF_CONDUCT.md
test -s CHANGELOG.md
test -s .github/PULL_REQUEST_TEMPLATE.md
test -s .github/ISSUE_TEMPLATE/bug_report.yml
test -s .github/ISSUE_TEMPLATE/feature_request.yml
test -s docs/release/versioning.md
test -s docs/release/v0.1-checklist.md

grep -q 'Apache License' LICENSE
grep -q 'single-instance production candidate' README.md
grep -q 'pnpm verify' CONTRIBUTING.md
grep -q 'private vulnerability reporting' SECURITY.md
grep -q '\[0.1.0\]' CHANGELOG.md

echo "== Repository verification =="
pnpm verify

echo "== Phase 12.1 complete =="
echo "Review git diff before committing."

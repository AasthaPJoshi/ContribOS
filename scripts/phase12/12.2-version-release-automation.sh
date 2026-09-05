#!/usr/bin/env bash
set -euo pipefail

echo "== ContribOS Phase 12.2: version finalization + release automation =="

mkdir -p .github/workflows docs/release scripts/phase12

echo "== 12.2.1 Set workspace versions to 0.1.0 =="

node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const files = [
  "package.json",
  "apps/control-plane/package.json",
  "apps/web/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/github/package.json",
  "packages/state-engine/package.json",
  "packages/worker/package.json"
];

for (const file of files) {
  const full = path.resolve(file);
  const pkg = JSON.parse(fs.readFileSync(full, "utf8"));
  pkg.version = "0.1.0";
  fs.writeFileSync(full, JSON.stringify(pkg, null, 2) + "\n");
}
NODE

echo "== 12.2.2 Add CI verification workflow =="

cat > .github/workflows/ci.yml <<'YAML'
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: contribos
          POSTGRES_PASSWORD: contribos_ci
          POSTGRES_DB: contribos
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U contribos -d contribos"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://contribos:contribos_ci@127.0.0.1:5432/contribos

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Enable Corepack
        run: corepack enable

      - name: Use Node 24
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Prepare pnpm
        run: corepack prepare pnpm@10.17.1 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Verify repository
        run: pnpm verify
YAML

echo "== 12.2.3 Add release workflow =="

cat > .github/workflows/release.yml <<'YAML'
name: Release

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: contribos
          POSTGRES_PASSWORD: contribos_release
          POSTGRES_DB: contribos
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U contribos -d contribos"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://contribos:contribos_release@127.0.0.1:5432/contribos

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Enable Corepack
        run: corepack enable

      - name: Use Node 24
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Prepare pnpm
        run: corepack prepare pnpm@10.17.1 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Verify tag matches repository version
        run: |
          VERSION="$(node -p "require('./package.json').version")"
          TAG="${GITHUB_REF_NAME}"
          if [ "$TAG" != "v$VERSION" ]; then
            echo "Tag $TAG does not match package version v$VERSION." >&2
            exit 1
          fi

      - name: Run production readiness gate
        run: ./scripts/ops/verify-production-readiness.sh

      - name: Create GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "$GITHUB_REF_NAME" \
            --verify-tag \
            --title "ContribOS $GITHUB_REF_NAME" \
            --generate-notes
YAML

echo "== 12.2.4 Add release preparation tooling =="

cat > scripts/ops/verify-release.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VERSION="${1:-0.1.0}"
EXPECTED_TAG="v${EXPECTED_VERSION}"

echo "== ContribOS release verification: ${EXPECTED_TAG} =="

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree must be clean before release verification." >&2
  exit 1
fi

if git rev-parse "$EXPECTED_TAG" >/dev/null 2>&1; then
  echo "Tag ${EXPECTED_TAG} already exists." >&2
  exit 1
fi

node - "$EXPECTED_VERSION" <<'NODE'
const fs = require("node:fs");

const expected = process.argv[2];
const files = [
  "package.json",
  "apps/control-plane/package.json",
  "apps/web/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/github/package.json",
  "packages/state-engine/package.json",
  "packages/worker/package.json"
];

for (const file of files) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (pkg.version !== expected) {
    console.error(`${file} has version ${pkg.version}; expected ${expected}.`);
    process.exit(1);
  }
}

console.log(`All workspace package versions match ${expected}.`);
NODE

grep -q "## \[${EXPECTED_VERSION}\]" CHANGELOG.md
grep -q 'name: CI' .github/workflows/ci.yml
grep -q 'name: Release' .github/workflows/release.yml
grep -q '"v\*\.\*\.\*"' .github/workflows/release.yml

echo "== Repository verification =="
pnpm verify

echo "== Production readiness verification =="
./scripts/ops/verify-production-readiness.sh

echo "== Release verification passed for ${EXPECTED_TAG} =="
echo "No tag was created."
SH
chmod +x scripts/ops/verify-release.sh

cat > docs/release/release-process.md <<'EOF'
# Release Process

ContribOS uses an explicit release commit followed by an annotated semantic-version tag.

For v0.1.0:

1. finish and review the release-candidate changes
2. ensure all workspace package versions are `0.1.0`
3. finalize the `CHANGELOG.md` release date
4. ensure the Git working tree is clean
5. run:

```sh
./scripts/ops/verify-release.sh 0.1.0
```

6. create the annotated tag only after the release verification passes:

```sh
git tag -a v0.1.0 -m "ContribOS v0.1.0"
```

7. inspect the tag:

```sh
git show --stat v0.1.0
```

8. push the release commit and tag deliberately:

```sh
git push origin <release-branch>
git push origin v0.1.0
```

Pushing the tag triggers `.github/workflows/release.yml`.

The release workflow:

- verifies the tag matches the root package version
- runs the production-readiness gate
- builds the production container as part of that gate
- creates the GitHub Release only after verification passes

A failed release workflow must not be bypassed by creating a GitHub Release manually without understanding the failure.

## Important v0.1 boundary

v0.1.0 remains a single-instance production candidate.

Do not describe the release as multi-replica or horizontally production-ready.
EOF

cat > docs/product/phase-12.2-version-release-automation.md <<'EOF'
# Phase 12.2 - Version Finalization and Release Automation

Phase 12.2 prepares ContribOS for the first semantic-versioned release.

Delivered:

- all first-party workspace packages moved to version `0.1.0`
- pull request and main-branch CI verification
- tag-triggered GitHub Release workflow
- tag-to-package-version validation
- production-readiness verification before GitHub Release creation
- repeatable local release verification
- documented release process

This phase does not create or push the `v0.1.0` tag.

The tag remains an explicit human-controlled release action after live dogfood validation and final release review.
EOF

echo "== 12.2.5 Refresh lockfile metadata =="

pnpm install --lockfile-only

echo "== 12.2 validation =="

node <<'NODE'
const fs = require("node:fs");

const files = [
  "package.json",
  "apps/control-plane/package.json",
  "apps/web/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/github/package.json",
  "packages/state-engine/package.json",
  "packages/worker/package.json"
];

for (const file of files) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (pkg.version !== "0.1.0") {
    throw new Error(`${file} did not update to 0.1.0`);
  }
}
NODE

bash -n scripts/ops/verify-release.sh
bash -n scripts/phase12/12.2-version-release-automation.sh

grep -q 'node-version: 24' .github/workflows/ci.yml
grep -q 'pnpm@10.17.1' .github/workflows/ci.yml
grep -q 'v\*.\*.\*' .github/workflows/release.yml
grep -q 'verify-production-readiness.sh' .github/workflows/release.yml

echo "== Repository verification =="
pnpm verify

echo "== Phase 12.2 complete =="
echo "Review the diff before committing. No release tag was created."

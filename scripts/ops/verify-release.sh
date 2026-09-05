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

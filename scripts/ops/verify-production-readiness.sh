#!/usr/bin/env bash
set -euo pipefail

echo "== ContribOS production-readiness verification =="

echo "== Repository hygiene =="
git diff --check

if ! git check-ignore -q .secrets/example; then
  echo ".secrets is not ignored by Git." >&2
  exit 1
fi

echo "== High-confidence tracked-secret scan =="
tracked_files="$(git ls-files ':!:**/tests/**' ':!:scripts/phase11/**' ':!:docs/**' ':!:scripts/ops/verify-production-readiness.sh')"
if [[ -n "$tracked_files" ]]; then
  if printf '%s\n' "$tracked_files" | xargs grep -nE -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,}' 2>/dev/null; then
    echo "Potential real credential found in tracked production files." >&2
    exit 1
  fi
fi

echo "== Required security controls =="
grep -q '"content-security-policy"' apps/control-plane/src/security/security-headers.ts
grep -q '"x-frame-options": "DENY"' apps/control-plane/src/security/security-headers.ts
grep -q '"x-content-type-options": "nosniff"' apps/control-plane/src/security/security-headers.ts
grep -q '"HttpOnly"' apps/control-plane/src/security/session-cookie.ts
grep -q 'attributes.push("Secure")' apps/control-plane/src/security/session-cookie.ts
grep -q 'verifyGitHubWebhookSignature' apps/control-plane/src/github-webhook-service.ts
grep -q 'checkDatabaseReady' apps/control-plane/src/service-entrypoint.ts
grep -q 'USER contribos' deploy/Dockerfile.control-plane
grep -q 'HEALTHCHECK' deploy/Dockerfile.control-plane

echo "== Production preflight self-test =="
VALID_KEY="$(node -e 'process.stdout.write(Buffer.alloc(32, 7).toString("base64"))')"

env \
  DATABASE_URL='postgresql://user:pass@db.example/contribos' \
  GITHUB_APP_ID='12345' \
  GITHUB_PRIVATE_KEY='-----BEGIN PRIVATE KEY----- test -----END PRIVATE KEY-----' \
  GITHUB_WEBHOOK_SECRET='0123456789abcdef0123456789abcdef' \
  GITHUB_CLIENT_ID='Iv1.example' \
  GITHUB_CLIENT_SECRET='example-client-secret' \
  CONTRIBOS_PUBLIC_BASE_URL='https://contribos.example.com' \
  CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY="$VALID_KEY" \
  ./scripts/ops/preflight-production.sh

if env \
  DATABASE_URL='postgresql://user:pass@db.example/contribos' \
  GITHUB_APP_ID='12345' \
  GITHUB_PRIVATE_KEY='-----BEGIN PRIVATE KEY----- test -----END PRIVATE KEY-----' \
  GITHUB_WEBHOOK_SECRET='0123456789abcdef0123456789abcdef' \
  GITHUB_CLIENT_ID='Iv1.example' \
  GITHUB_CLIENT_SECRET='example-client-secret' \
  CONTRIBOS_PUBLIC_BASE_URL='http://contribos.example.com' \
  CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY="$VALID_KEY" \
  ./scripts/ops/preflight-production.sh >/dev/null 2>&1; then
  echo "Production preflight incorrectly accepted HTTP." >&2
  exit 1
fi

echo "== Targeted security tests =="
pnpm --filter @contribos/control-plane test -- \
  tests/security-headers.test.ts \
  tests/http-security-hardening.test.ts \
  tests/auth-service.test.ts \
  tests/webhook-security-order.test.ts \
  tests/readiness.test.ts

echo "== Full repository verification =="
pnpm verify

if command -v docker >/dev/null 2>&1; then
  echo "== Production image build =="
  docker build \
    -f deploy/Dockerfile.control-plane \
    -t contribos-control-plane:phase11.10 \
    .
else
  echo "Docker not available; image build skipped."
fi

echo "== Production-readiness verification passed =="

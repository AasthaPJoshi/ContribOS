#!/usr/bin/env bash
set -euo pipefail

echo "== ContribOS Phase 11.10: final security + production verification =="

mkdir -p scripts/ops docs/runbooks docs/product

echo "== 11.10.1 Harden API security headers =="

cat > apps/control-plane/src/security/security-headers.ts <<'TS'
export type SecurityHeaderMap =
  Readonly<Record<string, string>>;

export function securityHeaders():
  SecurityHeaderMap {
  return {
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=()"
  };
}
TS

cat > apps/control-plane/tests/security-headers.test.ts <<'TS'
import {
  describe,
  expect,
  it
} from "vitest";

import {
  securityHeaders
} from "../src/security/security-headers.js";

describe(
  "security headers",
  () => {
    it("returns conservative API defaults", () => {
      expect(
        securityHeaders()
      ).toEqual({
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        "referrer-policy":
          "no-referrer",
        "x-content-type-options":
          "nosniff",
        "x-frame-options": "DENY",
        "permissions-policy":
          "camera=(), microphone=(), geolocation=()"
      });
    });
  }
);
TS

python3 - <<'PY'
from pathlib import Path
p = Path('apps/control-plane/tests/http-security-hardening.test.ts')
s = p.read_text()
needle = '      expect(\n        response.headers.get(\n          "x-content-type-options"\n        )\n      ).toBe("nosniff");\n'
insert = '      expect(\n        response.headers.get(\n          "content-security-policy"\n        )\n      ).toBe(\n        "default-src \'none\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'none\'"\n      );\n\n'
if insert not in s:
    if needle not in s:
        raise SystemExit('HTTP security header test anchor not found.')
    s = s.replace(needle, insert + needle, 1)
p.write_text(s)
PY

echo "== 11.10.2 Harden production preflight =="

cat > scripts/ops/preflight-production.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

required=(
  DATABASE_URL
  GITHUB_APP_ID
  GITHUB_PRIVATE_KEY
  GITHUB_WEBHOOK_SECRET
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  CONTRIBOS_PUBLIC_BASE_URL
  CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY
)

missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing required production environment variables:\n' >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

node <<'NODE'
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const appId = Number(process.env.GITHUB_APP_ID);
if (!Number.isSafeInteger(appId) || appId <= 0) {
  fail("GITHUB_APP_ID must be a positive integer.");
}

let publicUrl;
try {
  publicUrl = new URL(process.env.CONTRIBOS_PUBLIC_BASE_URL);
} catch {
  fail("CONTRIBOS_PUBLIC_BASE_URL must be a valid URL.");
}

if (publicUrl.protocol !== "https:") {
  fail("CONTRIBOS_PUBLIC_BASE_URL must use https in production.");
}

if (publicUrl.username || publicUrl.password) {
  fail("CONTRIBOS_PUBLIC_BASE_URL must not contain credentials.");
}

const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl.startsWith("postgresql://") &&
  !databaseUrl.startsWith("postgres://")
) {
  fail("DATABASE_URL must be a PostgreSQL connection string.");
}

const decoded = Buffer.from(
  process.env.CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY,
  "base64"
);
if (decoded.length !== 32) {
  fail("CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes.");
}

if (!process.env.GITHUB_PRIVATE_KEY.includes("PRIVATE KEY")) {
  fail("GITHUB_PRIVATE_KEY does not look like a PEM private key.");
}

if (process.env.GITHUB_WEBHOOK_SECRET.length < 16) {
  fail("GITHUB_WEBHOOK_SECRET is too short for production.");
}

console.log("Production configuration preflight passed.");
NODE
SH
chmod +x scripts/ops/preflight-production.sh

echo "== 11.10.3 Add production verification gate =="

cat > scripts/ops/verify-production-readiness.sh <<'SH'
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
tracked_files="$(git ls-files ':!:**/tests/**' ':!:scripts/phase11/**' ':!:docs/**')"
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
SH
chmod +x scripts/ops/verify-production-readiness.sh

echo "== 11.10.4 Update production security documentation =="

cat > docs/runbooks/production-security.md <<'EOF'
# Production Security Runbook

## Security boundary

ContribOS v0.1 uses GitHub App installation authentication, GitHub OAuth, opaque HttpOnly browser sessions, encrypted GitHub user credentials at rest, HMAC-verified webhooks, repository-scope checks, conservative API security headers, request correlation, dependency-aware readiness, and non-root container execution.

## Browser and HTTP headers

The control plane sends `Cache-Control: no-store`, a restrictive Content Security Policy, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a restrictive Permissions Policy.

TLS termination and HTTP Strict Transport Security should be configured at the trusted ingress/reverse-proxy layer.

## Rate limiting

ContribOS does not trust arbitrary forwarded client-IP headers and therefore does not implement a misleading process-local IP rate limiter in v0.1. Production ingress should rate-limit public authentication and API endpoints using the platform's trusted client-IP information. GitHub webhook rate limiting must be configured carefully so legitimate deliveries and retries are not dropped.

## Single-instance production boundary

The current v0.1 production candidate is intended for a single control-plane instance. Before horizontal scaling, serialize schema migration ownership, replace process-local worker coordination with distributed coordination, decide sweep ownership, validate OAuth refresh concurrency across replicas, validate shared ingress rate limiting, and perform multi-replica failure testing.

Do not describe v0.1 as horizontally production-ready until those controls exist.

## GitHub App visibility

Before public release, explicitly review whether the GitHub App should remain public or be limited to the intended installation audience. This is a GitHub-side configuration decision and cannot be verified solely from the repository.

## Release security gate

Run:

```sh
./scripts/ops/verify-production-readiness.sh
```

The gate checks repository hygiene, high-confidence credential patterns, required security controls, production configuration validation, targeted security tests, the full repository verification suite, and a Docker image build when Docker is available.
EOF

cat > docs/product/phase-11.10-production-verification.md <<'EOF'
# Phase 11.10 - Final Security and Production Verification

Phase 11.10 closes the Phase 11 production-hardening sequence.

Delivered:

- restrictive Content Security Policy for the API control plane
- stronger production environment preflight validation
- high-confidence tracked-secret scanning
- explicit verification of session, webhook, readiness, and container controls
- repeatable final production-readiness verification script
- production security runbook
- current documentation for OAuth refresh behavior
- explicit single-instance v0.1 production boundary

## Release classification

Passing Phase 11.10 means ContribOS is a **single-instance v0.1 production candidate**.

It does not mean horizontally scalable production architecture, multi-region availability, zero-downtime schema migration across replicas, distributed rate limiting, distributed worker locking, or completed public-release packaging.

The next product milestone is Phase 12: public release and v0.1 packaging/dogfooding.
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('docs/product/phase-9-security.md')
s = p.read_text()
replacements = {
    'Refresh-token rotation is intentionally deferred to Phase 9 hardening.': 'Refresh-token rotation was implemented during Phase 11 production hardening.',
    'Automatic refresh-token rotation is not enabled yet.': 'Automatic GitHub OAuth access-token refresh and refresh-token rotation are enabled when GitHub supplies a usable refresh token.',
    'Automatic token refresh is deferred because it requires atomic replacement of access and refresh credentials, failure recovery, and concurrency control around simultaneous refresh attempts. Reauthentication is the fail-closed behavior for this phase.': 'Phase 11 added encrypted access/refresh credential replacement during session resolution. If refresh material is unavailable or unusable, repository authorization continues to fail closed with reauthentication.'
}
for old, new in replacements.items():
    if old in s:
        s = s.replace(old, new)
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p = Path('.env.production.example')
s = p.read_text()
old = 'GITHUB_WEBHOOK_SECRET=\n'
new = '# Use a high-entropy value; 32+ random bytes is recommended.\nGITHUB_WEBHOOK_SECRET=\n'
if new not in s:
    if old not in s:
        raise SystemExit('Webhook secret env anchor not found.')
    s = s.replace(old, new, 1)
p.write_text(s)
PY

echo "== 11.10.5 Validate phase script and production gate =="
bash -n scripts/ops/preflight-production.sh
bash -n scripts/ops/verify-production-readiness.sh
bash -n scripts/phase11/11.10-final-security-verification.sh
./scripts/ops/verify-production-readiness.sh

echo "== Phase 11.10 complete =="
echo "Review git diff before committing."

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: Run this script from inside the ContribOS repository."
  exit 1
fi

cd "$ROOT"

echo "== ContribOS Phase 9 Part 5: Final Security Hardening =="

echo
echo "== 1. Fix frontend attention-queue contract drift =="

python3 - <<'PY'
from pathlib import Path

types = Path("apps/web/src/api/types.ts")
text = types.read_text()

old = '''export interface AttentionQueueItem
  extends RepositoryContributionSummary {
  repositoryId: string;
  repositoryFullName: string;
  updatedAt: string;
  priorityScore: number;
  priorityBand:
    | "CRITICAL"
    | "HIGH"
    | "NORMAL"
    | "LOW";
  priorityReasons: string[];
}
'''

new = '''export interface AttentionQueueItem {
  contributionId: string;
  repositoryId: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  url: string;
  updatedAt: string;
  lastReconciledAt: string | null;
  workflowState: WorkflowState;
  nextActor: NextActor;
  readiness: Readiness;
  reasonCode: string;
  priorityScore: number;
  priorityBand:
    | "CRITICAL"
    | "HIGH"
    | "NORMAL"
    | "LOW";
  priorityReasons: string[];
}
'''

if old in text:
    text = text.replace(old, new, 1)
elif "export interface AttentionQueueItem {" not in text:
    raise SystemExit("AttentionQueueItem contract block not found.")

types.write_text(text)

page = Path("apps/web/src/pages/attention-page.tsx")
ptext = page.read_text()
ptext = ptext.replace(
    "key={item.id}",
    "key={item.contributionId}"
)
page.write_text(ptext)
PY

echo
echo "== 2. Add durable auth migration regression coverage =="

cat > packages/db/tests/auth-migration.test.ts <<'EOF'
import {
  readdir,
  readFile
} from "node:fs/promises";
import {
  dirname,
  join
} from "node:path";
import {
  fileURLToPath
} from "node:url";

import {
  PGlite
} from "@electric-sql/pglite";
import {
  describe,
  expect,
  it
} from "vitest";

const packageRoot = join(
  dirname(
    fileURLToPath(
      import.meta.url
    )
  ),
  ".."
);

async function migrationFiles():
  Promise<string[]> {
  const directory =
    join(
      packageRoot,
      "drizzle"
    );

  const entries =
    await readdir(
      directory,
      {
        withFileTypes: true
      }
    );

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(
          ".sql"
        )
    )
    .map(
      (entry) =>
        join(
          directory,
          entry.name
        )
    )
    .sort();
}

async function migratedDatabase() {
  const pg =
    await PGlite.create();

  for (
    const file of
    await migrationFiles()
  ) {
    await pg.exec(
      await readFile(
        file,
        "utf8"
      )
    );
  }

  return pg;
}

describe(
  "Phase 9 auth migration",
  () => {
    it("creates durable auth tables", async () => {
      const pg =
        await migratedDatabase();

      try {
        const result =
          await pg.query<{
            table_name: string;
          }>(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                'auth_users',
                'auth_sessions',
                'oauth_states'
              )
            ORDER BY table_name;
          `);

        expect(
          result.rows.map(
            (row) =>
              row.table_name
          )
        ).toEqual([
          "auth_sessions",
          "auth_users",
          "oauth_states"
        ]);
      } finally {
        await pg.close();
      }
    });

    it("enforces one provider identity per GitHub user", async () => {
      const pg =
        await migratedDatabase();

      try {
        await pg.query(
          `
          INSERT INTO auth_users (
            id,
            provider,
            provider_user_id,
            login,
            github_access_token_ciphertext
          )
          VALUES (
            $1, $2, $3, $4, $5
          );
          `,
          [
            "11111111-1111-4111-8111-111111111111",
            "GITHUB",
            "42",
            "octocat",
            "ciphertext-1"
          ]
        );

        await expect(
          pg.query(
            `
            INSERT INTO auth_users (
              id,
              provider,
              provider_user_id,
              login,
              github_access_token_ciphertext
            )
            VALUES (
              $1, $2, $3, $4, $5
            );
            `,
            [
              "22222222-2222-4222-8222-222222222222",
              "GITHUB",
              "42",
              "octocat-2",
              "ciphertext-2"
            ]
          )
        ).rejects.toThrow();
      } finally {
        await pg.close();
      }
    });

    it("enforces unique opaque session hashes", async () => {
      const pg =
        await migratedDatabase();

      try {
        const userId =
          "11111111-1111-4111-8111-111111111111";

        await pg.query(
          `
          INSERT INTO auth_users (
            id,
            provider,
            provider_user_id,
            login,
            github_access_token_ciphertext
          )
          VALUES (
            $1, $2, $3, $4, $5
          );
          `,
          [
            userId,
            "GITHUB",
            "42",
            "octocat",
            "ciphertext"
          ]
        );

        await pg.query(
          `
          INSERT INTO auth_sessions (
            id,
            user_id,
            token_hash,
            expires_at
          )
          VALUES (
            $1, $2, $3, $4
          );
          `,
          [
            "22222222-2222-4222-8222-222222222222",
            userId,
            "a".repeat(64),
            "2030-01-01T00:00:00Z"
          ]
        );

        await expect(
          pg.query(
            `
            INSERT INTO auth_sessions (
              id,
              user_id,
              token_hash,
              expires_at
            )
            VALUES (
              $1, $2, $3, $4
            );
            `,
            [
              "33333333-3333-4333-8333-333333333333",
              userId,
              "a".repeat(64),
              "2030-01-01T00:00:00Z"
            ]
          )
        ).rejects.toThrow();
      } finally {
        await pg.close();
      }
    });

    it("enforces unique OAuth state hashes", async () => {
      const pg =
        await migratedDatabase();

      try {
        await pg.query(
          `
          INSERT INTO oauth_states (
            id,
            state_hash,
            expires_at
          )
          VALUES (
            $1, $2, $3
          );
          `,
          [
            "11111111-1111-4111-8111-111111111111",
            "b".repeat(64),
            "2030-01-01T00:00:00Z"
          ]
        );

        await expect(
          pg.query(
            `
            INSERT INTO oauth_states (
              id,
              state_hash,
              expires_at
            )
            VALUES (
              $1, $2, $3
            );
            `,
            [
              "22222222-2222-4222-8222-222222222222",
              "b".repeat(64),
              "2030-01-01T00:00:00Z"
            ]
          )
        ).rejects.toThrow();
      } finally {
        await pg.close();
      }
    });
  }
);
EOF

echo
echo "== 3. Harden HTTP privacy and webhook media type =="

python3 - <<'PY'
from pathlib import Path

path = Path("apps/control-plane/src/http-server.ts")
text = path.read_text()

needle = '''function sameOrigin(
  request: IncomingMessage,
  publicOrigin: string
): boolean {
'''

helper = '''function isJsonContentType(
  request: IncomingMessage
): boolean {
  const value =
    header(
      request,
      "content-type"
    );

  if (!value) {
    return false;
  }

  return value
    .toLowerCase()
    .split(";", 1)[0]
    ?.trim() ===
    "application/json";
}

'''

if "function isJsonContentType(" not in text:
    if needle not in text:
        raise SystemExit("sameOrigin insertion point not found.")
    text = text.replace(
        needle,
        helper + needle,
        1
    )

old = '''              json(
                response,
                reauth
                  ? 401
                  : 403,
                {
                  status: "ERROR",
                  reasonCode:
                    authorization
                      .reason
                }
              );
'''

new = '''              const hiddenRepository =
                authorization.reason ===
                "REPOSITORY_NOT_AUTHORIZED";

              json(
                response,
                reauth
                  ? 401
                  : hiddenRepository
                    ? 404
                    : 403,
                hiddenRepository
                  ? {
                      status:
                        "NOT_FOUND"
                    }
                  : {
                      status: "ERROR",
                      reasonCode:
                        authorization
                          .reason
                    }
              );
'''

if old in text:
    text = text.replace(old, new, 1)

webhook_old = '''        if (
          request.method ===
            "POST" &&
          url.pathname ===
            "/webhooks/github"
        ) {
          const rawBody =
            await readRawBody(
              request
            );
'''

webhook_new = '''        if (
          request.method ===
            "POST" &&
          url.pathname ===
            "/webhooks/github"
        ) {
          if (
            !isJsonContentType(
              request
            )
          ) {
            json(
              response,
              415,
              {
                status: "ERROR",
                reasonCode:
                  "UNSUPPORTED_MEDIA_TYPE"
              }
            );
            return;
          }

          const rawBody =
            await readRawBody(
              request
            );
'''

if webhook_old in text:
    text = text.replace(
        webhook_old,
        webhook_new,
        1
    )
else:
    raise SystemExit("Webhook block not found.")

path.write_text(text)
PY

cat > apps/control-plane/tests/http-security-hardening.test.ts <<'EOF'
import type {
  AddressInfo
} from "node:net";

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  createControlPlaneServer
} from "../src/http-server.js";

const SESSION_TOKEN =
  "A".repeat(43);

const servers:
  ReturnType<
    typeof createControlPlaneServer
  >[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>(
          (resolve) => {
            server.close(
              () => resolve()
            );
          }
        )
    )
  );

  servers.length = 0;
});

function options(
  authorizationResult:
    unknown = {
      allowed: false,
      reason:
        "REPOSITORY_NOT_AUTHORIZED"
    }
) {
  return {
    health: {
      snapshot: () => ({
        live: true,
        ready: true,
        shuttingDown: false
      })
    } as never,
    webhook: {
      handle:
        vi.fn()
          .mockResolvedValue({
            statusCode: 202,
            body: {
              status: "OK"
            }
          })
    } as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    },
    productQueries: {
      getRepositoryOverview:
        vi.fn(),
      getRepositoryDashboard:
        vi.fn(),
      getMaintainerAttentionQueue:
        vi.fn(),
      getContributionDetail:
        vi.fn(),
      getContributionDecisionTrail:
        vi.fn()
    } as never,
    auth: {
      beginLogin:
        vi.fn(),
      completeLogin:
        vi.fn(),
      resolveSessionContext:
        vi.fn()
          .mockResolvedValue({
            sessionId:
              "session-1",
            userId:
              "user-1",
            principal: {
              provider:
                "GITHUB",
              providerUserId:
                "42",
              login:
                "octocat"
            },
            githubAccessTokenCiphertext:
              "encrypted",
            githubAccessTokenExpiresAt:
              null
          }),
      signOut:
        vi.fn()
    } as never,
    repositoryAuthorization: {
      authorize:
        vi.fn()
          .mockResolvedValue(
            authorizationResult
          )
    } as never,
    publicOrigin:
      "http://localhost:5173"
  };
}

async function start(
  authorizationResult?:
    unknown
) {
  const server =
    createControlPlaneServer(
      options(
        authorizationResult
      )
    );

  servers.push(server);

  await new Promise<void>(
    (resolve) => {
      server.listen(
        0,
        "127.0.0.1",
        () => resolve()
      );
    }
  );

  return server;
}

describe(
  "HTTP security hardening",
  () => {
    it("hides repository existence when the user is not authorized", async () => {
      const server =
        await start();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`,
          {
            headers: {
              cookie:
                `contribos_session=${SESSION_TOKEN}`
            }
          }
        );

      expect(
        response.status
      ).toBe(404);

      await expect(
        response.json()
      ).resolves.toEqual({
        status:
          "NOT_FOUND"
      });
    });

    it("rejects webhook bodies without JSON content type before dispatch", async () => {
      const localOptions =
        options();

      const server =
        createControlPlaneServer(
          localOptions
        );

      servers.push(server);

      await new Promise<void>(
        (resolve) => {
          server.listen(
            0,
            "127.0.0.1",
            () => resolve()
          );
        }
      );

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/webhooks/github`,
          {
            method: "POST",
            headers: {
              "content-type":
                "text/plain"
            },
            body: "{}"
          }
        );

      expect(
        response.status
      ).toBe(415);

      expect(
        localOptions
          .webhook
          .handle
      ).not.toHaveBeenCalled();
    });

    it("sends baseline security headers on API responses", async () => {
      const server =
        await start();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`,
          {
            headers: {
              cookie:
                `contribos_session=${SESSION_TOKEN}`
            }
          }
        );

      expect(
        response.headers.get(
          "cache-control"
        )
      ).toBe("no-store");

      expect(
        response.headers.get(
          "x-content-type-options"
        )
      ).toBe("nosniff");

      expect(
        response.headers.get(
          "x-frame-options"
        )
      ).toBe("DENY");
    });
  }
);
EOF

echo
echo "== 4. Update existing HTTP authorization expectation =="

python3 - <<'PY'
from pathlib import Path

path = Path(
    "apps/control-plane/tests/http-server-product-api.test.ts"
)
text = path.read_text()

text = text.replace(
    'it("returns 403 when repository authorization fails"',
    'it("returns 404 when repository authorization fails to avoid existence leakage"',
    1
)

marker = '''      expect(
        response.status
      ).toBe(403);
'''

if marker in text:
    text = text.replace(
        marker,
        '''      expect(
        response.status
      ).toBe(404);
''',
        1
    )

path.write_text(text)
PY

echo
echo "== 5. Add webhook signature-order regression test =="

cat > apps/control-plane/tests/webhook-security-order.test.ts <<'EOF'
import {
  readFile
} from "node:fs/promises";
import {
  dirname,
  join
} from "node:path";
import {
  fileURLToPath
} from "node:url";

import {
  describe,
  expect,
  it
} from "vitest";

const here =
  dirname(
    fileURLToPath(
      import.meta.url
    )
  );

describe(
  "webhook security ordering",
  () => {
    it("keeps signature verification before any JSON parsing in the ingestion boundary", async () => {
      const source =
        await readFile(
          join(
            here,
            "../../../packages/github/src/ingest-webhook.ts"
          ),
          "utf8"
        );

      const verifyIndex =
        source.indexOf(
          "verifyGitHubWebhookSignature"
        );

      const parseIndex =
        source.indexOf(
          "JSON.parse"
        );

      expect(
        verifyIndex
      ).toBeGreaterThanOrEqual(0);

      if (
        parseIndex >= 0
      ) {
        expect(
          verifyIndex
        ).toBeLessThan(
          parseIndex
        );
      }
    });
  }
);
EOF

echo
echo "== 6. Finalize Phase 9 documentation =="

cat >> docs/product/phase-9-security.md <<'EOF'

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
EOF

echo
echo "== 7. Remove completed Part 4 helper script =="
rm -f phase9_part4_auth_enforcement.sh

echo
echo "== 8. Targeted DB verification =="
pnpm --filter @contribos/db typecheck
pnpm --filter @contribos/db test
pnpm --filter @contribos/db build

echo
echo "== 9. Targeted control-plane verification =="
pnpm --filter @contribos/control-plane typecheck
pnpm --filter @contribos/control-plane test
pnpm --filter @contribos/control-plane build

echo
echo "== 10. Targeted frontend verification =="
pnpm --filter @contribos/web typecheck
pnpm --filter @contribos/web test
pnpm --filter @contribos/web build

echo
echo "== 11. Full monorepo verification =="
pnpm verify

echo
echo "== 12. Final Git status =="
git status --short

echo
echo "Phase 9 Part 5 hardening completed."
echo "Do not commit yet."

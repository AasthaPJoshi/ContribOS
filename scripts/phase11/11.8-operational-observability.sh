#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "== ContribOS Phase 11.8: operational observability + readiness =="

mkdir -p apps/control-plane/src apps/control-plane/tests packages/db/src packages/db/tests

cat > apps/control-plane/src/request-observability.ts <<'TS'
import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,128}$/;

export interface RequestMetricsSnapshot {
  totalRequests: number;
  activeRequests: number;
  failedRequests: number;
}

export function resolveRequestId(
  candidate: string | undefined
): string {
  const normalized = candidate?.trim();

  if (
    normalized &&
    REQUEST_ID_PATTERN.test(normalized)
  ) {
    return normalized;
  }

  return randomUUID();
}

export class RequestMetrics {
  private totalRequests = 0;
  private activeRequests = 0;
  private failedRequests = 0;

  begin(): void {
    this.totalRequests += 1;
    this.activeRequests += 1;
  }

  finish(statusCode: number): void {
    this.activeRequests = Math.max(
      0,
      this.activeRequests - 1
    );

    if (statusCode >= 500) {
      this.failedRequests += 1;
    }
  }

  snapshot(): RequestMetricsSnapshot {
    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      failedRequests: this.failedRequests
    };
  }
}
TS

cat > apps/control-plane/src/readiness.ts <<'TS'
export interface ReadinessCheckResult {
  ready: boolean;
  reasonCode?: string;
}

export type ReadinessCheck =
  () => Promise<ReadinessCheckResult>;

export type ReadinessChecks =
  Record<string, ReadinessCheck>;

const DEFAULT_READINESS_TIMEOUT_MS =
  2_000;

async function runReadinessCheck(
  check: ReadinessCheck,
  timeoutMs: number
): Promise<ReadinessCheckResult> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      check(),
      new Promise<ReadinessCheckResult>(
        (resolve) => {
          timer = setTimeout(
            () => {
              resolve({
                ready: false,
                reasonCode:
                  "READINESS_CHECK_TIMEOUT"
              });
            },
            timeoutMs
          );
        }
      )
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function evaluateReadinessChecks(
  checks: ReadinessChecks,
  timeoutMs =
    DEFAULT_READINESS_TIMEOUT_MS
): Promise<Record<string, ReadinessCheckResult>> {
  const entries = await Promise.all(
    Object.entries(checks).map(
      async ([name, check]) => {
        try {
          return [
            name,
            await runReadinessCheck(
              check,
              timeoutMs
            )
          ] as const;
        } catch {
          return [
            name,
            {
              ready: false,
              reasonCode:
                "READINESS_CHECK_FAILED"
            }
          ] as const;
        }
      }
    )
  );

  return Object.fromEntries(entries);
}

export function readinessChecksPassed(
  checks: Record<string, ReadinessCheckResult>
): boolean {
  return Object.values(checks).every(
    (result) => result.ready
  );
}
TS

cat > packages/db/src/health.ts <<'TS'
import { sql } from "drizzle-orm";

import type {
  ContribOSDatabase
} from "./database.js";

export interface DatabaseReadinessResult {
  ready: boolean;
  reasonCode?: string;
}

export type DatabaseReadinessRunner =
  (database: ContribOSDatabase) => Promise<void>;

export async function checkDatabaseReady(
  database: ContribOSDatabase,
  runner: DatabaseReadinessRunner =
    async (target) => {
      await target.execute(sql`select 1`);
    }
): Promise<DatabaseReadinessResult> {
  try {
    await runner(database);
    return { ready: true };
  } catch {
    return {
      ready: false,
      reasonCode: "DATABASE_UNAVAILABLE"
    };
  }
}
TS

cat > apps/control-plane/tests/request-observability.test.ts <<'TS'
import {
  describe,
  expect,
  it
} from "vitest";

import {
  RequestMetrics,
  resolveRequestId
} from "../src/request-observability.js";

describe("request observability", () => {
  it("preserves a safe caller request id", () => {
    expect(
      resolveRequestId("request-123")
    ).toBe("request-123");
  });

  it("replaces unsafe request ids", () => {
    const value = resolveRequestId(
      "bad request id with spaces"
    );

    expect(value).not.toBe(
      "bad request id with spaces"
    );
    expect(value.length).toBeGreaterThan(0);
  });

  it("tracks request lifecycle counters", () => {
    const metrics = new RequestMetrics();

    metrics.begin();
    metrics.begin();
    metrics.finish(200);
    metrics.finish(503);

    expect(metrics.snapshot()).toEqual({
      totalRequests: 2,
      activeRequests: 0,
      failedRequests: 1
    });
  });
});
TS

cat > apps/control-plane/tests/readiness.test.ts <<'TS'
import {
  describe,
  expect,
  it
} from "vitest";

import {
  evaluateReadinessChecks,
  readinessChecksPassed
} from "../src/readiness.js";

describe("readiness checks", () => {
  it("reports all healthy dependencies as ready", async () => {
    const results = await evaluateReadinessChecks({
      database: async () => ({ ready: true })
    });

    expect(readinessChecksPassed(results)).toBe(true);
    expect(results.database).toEqual({ ready: true });
  });

  it("times out a stalled dependency check", async () => {
    const results =
      await evaluateReadinessChecks(
        {
          database: () =>
            new Promise(() => {})
        },
        5
      );

    expect(
      readinessChecksPassed(results)
    ).toBe(false);

    expect(results.database).toEqual({
      ready: false,
      reasonCode:
        "READINESS_CHECK_TIMEOUT"
    });
  });

  it("fails closed when a dependency check throws", async () => {
    const results = await evaluateReadinessChecks({
      database: async () => {
        throw new Error("secret backend detail");
      }
    });

    expect(readinessChecksPassed(results)).toBe(false);
    expect(results.database).toEqual({
      ready: false,
      reasonCode: "READINESS_CHECK_FAILED"
    });
  });
});
TS

cat > packages/db/tests/health.test.ts <<'TS'
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  checkDatabaseReady
} from "../src/health.js";
import type {
  ContribOSDatabase
} from "../src/database.js";

const database = {} as ContribOSDatabase;

describe("database readiness", () => {
  it("reports ready after a successful probe", async () => {
    const runner = vi.fn(async () => undefined);

    await expect(
      checkDatabaseReady(database, runner)
    ).resolves.toEqual({ ready: true });

    expect(runner).toHaveBeenCalledWith(database);
  });

  it("returns a sanitized failure reason", async () => {
    const runner = vi.fn(async () => {
      throw new Error("connection secret");
    });

    await expect(
      checkDatabaseReady(database, runner)
    ).resolves.toEqual({
      ready: false,
      reasonCode: "DATABASE_UNAVAILABLE"
    });
  });
});
TS

python3 - <<'PY'
from pathlib import Path

# Export DB readiness helper.
p = Path("packages/db/src/index.ts")
s = p.read_text()
line = 'export * from "./health.js";\n'
if line not in s:
    s = line + s
    p.write_text(s)

# Patch HTTP server imports, options, request logging, and readiness checks.
p = Path("apps/control-plane/src/http-server.ts")
s = p.read_text()

logger_import = '''import type {
  RuntimeLogger
} from "./logger.js";
'''
extra_imports = logger_import + '''import {
  RequestMetrics,
  resolveRequestId
} from "./request-observability.js";
import {
  evaluateReadinessChecks,
  readinessChecksPassed,
  type ReadinessChecks
} from "./readiness.js";
'''
if 'from "./request-observability.js"' not in s:
    if logger_import not in s:
        raise SystemExit("http-server logger import anchor not found")
    s = s.replace(logger_import, extra_imports, 1)

option_anchor = '''  publicOrigin: string;
}'''
option_repl = '''  publicOrigin: string;
  readinessChecks?: ReadinessChecks;
}'''
if 'readinessChecks?: ReadinessChecks;' not in s:
    if option_anchor not in s:
        raise SystemExit("HttpServerOptions anchor not found")
    s = s.replace(option_anchor, option_repl, 1)

server_anchor = '''export function createControlPlaneServer(
  options: HttpServerOptions
): Server {
  return createServer(
'''
server_repl = '''export function createControlPlaneServer(
  options: HttpServerOptions
): Server {
  const requestMetrics =
    new RequestMetrics();

  return createServer(
'''
if 'const requestMetrics =' not in s:
    if server_anchor not in s:
        raise SystemExit("createControlPlaneServer anchor not found")
    s = s.replace(server_anchor, server_repl, 1)

handler_anchor = '''      applySecurityHeaders(
        response
      );

      try {
'''
handler_repl = '''      applySecurityHeaders(
        response
      );

      const requestId =
        resolveRequestId(
          header(
            request,
            "x-request-id"
          )
        );
      const startedAt =
        process.hrtime.bigint();
      const requestPath = (() => {
        try {
          return requestUrl(
            request,
            options.publicOrigin
          ).pathname;
        } catch {
          return "/invalid-url";
        }
      })();

      response.setHeader(
        "x-request-id",
        requestId
      );
      requestMetrics.begin();

      let requestFinalized = false;

      const finalizeRequest = (
        statusCode: number
      ): void => {
        if (requestFinalized) {
          return;
        }

        requestFinalized = true;

        requestMetrics.finish(
          statusCode
        );

        const durationMs = Number(
          process.hrtime.bigint() -
            startedAt
        ) / 1_000_000;

        options.logger.info(
          "http.request.completed",
          {
            requestId,
            method:
              request.method ??
              "UNKNOWN",
            path: requestPath,
            statusCode,
            durationMs:
              Math.round(
                durationMs * 100
              ) / 100,
            metrics:
              requestMetrics.snapshot()
          }
        );
      };

      response.once(
        "finish",
        () => {
          finalizeRequest(
            response.statusCode
          );
        }
      );

      response.once(
        "close",
        () => {
          if (!response.writableFinished) {
            finalizeRequest(499);
          }
        }
      );

      try {
'''
if 'http.request.completed' not in s:
    if handler_anchor not in s:
        raise SystemExit("HTTP handler anchor not found")
    s = s.replace(handler_anchor, handler_repl, 1)

ready_old = '''        if (
          request.method === "GET" &&
          url.pathname === "/ready"
        ) {
          const snapshot =
            options.health
              .snapshot();

          json(
            response,
            snapshot.ready
              ? 200
              : 503,
            snapshot
          );
          return;
        }
'''
ready_new = '''        if (
          request.method === "GET" &&
          url.pathname === "/ready"
        ) {
          const snapshot =
            options.health
              .snapshot();
          const checks =
            snapshot.ready
              ? await evaluateReadinessChecks(
                  options.readinessChecks ?? {}
                )
              : {};
          const ready =
            snapshot.ready &&
            readinessChecksPassed(
              checks
            );

          json(
            response,
            ready ? 200 : 503,
            {
              ...snapshot,
              ready,
              checks
            }
          );
          return;
        }
'''
if 'readinessChecksPassed(' not in s:
    if ready_old not in s:
        raise SystemExit("/ready route anchor not found")
    s = s.replace(ready_old, ready_new, 1)

error_old = '''        options.logger.error(
          "http.request.failed",
          {
            message:
              error instanceof Error
                ? error.message
                : "Unknown failure."
          }
        );
'''
error_new = '''        options.logger.error(
          "http.request.failed",
          {
            requestId,
            method:
              request.method ??
              "UNKNOWN",
            path: requestPath,
            message:
              error instanceof Error
                ? error.message
                : "Unknown failure."
          }
        );
'''
if '"http.request.failed",\n          {\n            requestId,' not in s:
    if error_old not in s:
        raise SystemExit("http error log anchor not found")
    s = s.replace(error_old, error_new, 1)

p.write_text(s)

# Wire database readiness into the service entrypoint.
p = Path("apps/control-plane/src/service-entrypoint.ts")
s = p.read_text()
if 'checkDatabaseReady,' not in s:
    anchor = '''import {
  AuthSessionRepository,
'''
    if anchor not in s:
        raise SystemExit("service-entrypoint DB import anchor not found")
    s = s.replace(anchor, '''import {
  checkDatabaseReady,
  AuthSessionRepository,
''', 1)

if 'readinessChecks:' not in s:
    anchor = '''    health:
      handle.runtime.health,
'''
    replacement = '''    health:
      handle.runtime.health,
    readinessChecks: {
      database: () =>
        checkDatabaseReady(handle.db)
    },
'''
    if anchor not in s:
        raise SystemExit("service-entrypoint health options anchor not found")
    s = s.replace(anchor, replacement, 1)

p.write_text(s)

# Export observability/readiness helpers from control-plane package.
p = Path("apps/control-plane/src/index.ts")
s = p.read_text()
for line in [
    'export * from "./request-observability.js";\n',
    'export * from "./readiness.js";\n',
]:
    if line not in s:
        s += line
p.write_text(s)
PY

echo "== Phase 11.8 targeted verification =="
pnpm --filter @contribos/db test
pnpm --filter @contribos/db typecheck
pnpm --filter @contribos/db build
pnpm --filter @contribos/control-plane test
pnpm --filter @contribos/control-plane typecheck
pnpm --filter @contribos/control-plane build

echo "== Full repository verification =="
pnpm verify

echo "== Phase 11.8 complete =="
echo "Review git diff before committing."

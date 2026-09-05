#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required for Phase 11.2-11.7 migration generation and tests.}"

mkdir -p scripts/phase11

echo "== ContribOS Phase 11.2-11.7: production hardening =="
echo "Repository: $ROOT"

echo
echo "== 11.2 Startup migration safety =="

cat > packages/db/src/migrations.ts <<'EOF'
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import type { ContribOSDatabase } from "./database.js";

export interface DatabaseMigrationOptions {
  migrationsFolder?: string;
  runner?: DatabaseMigrationRunner;
}

export type DatabaseMigrationRunner = (
  database: ContribOSDatabase,
  options: { migrationsFolder: string }
) => Promise<void>;

export function resolveMigrationsFolder(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../drizzle"
  );
}

export async function runDatabaseMigrations(
  database: ContribOSDatabase,
  options: DatabaseMigrationOptions = {}
): Promise<void> {
  const migrationsFolder =
    options.migrationsFolder ??
    resolveMigrationsFolder();

  if (
    !existsSync(migrationsFolder) ||
    !existsSync(
      join(
        migrationsFolder,
        "meta",
        "_journal.json"
      )
    )
  ) {
    throw new Error(
      `DATABASE_MIGRATIONS_NOT_FOUND:${migrationsFolder}`
    );
  }

  const runner: DatabaseMigrationRunner =
    options.runner ??
    (async (target, config) => {
      await migrate(target, config);
    });

  await runner(database, {
    migrationsFolder
  });
}
EOF

python3 <<'PY'
from pathlib import Path
p = Path("packages/db/src/index.ts")
s = p.read_text()
line = 'export * from "./migrations.js";\n'
if line not in s:
    anchor = 'export * from "./database.js";\n'
    if anchor not in s:
        raise SystemExit("Could not locate database export anchor.")
    s = s.replace(anchor, anchor + line)
p.write_text(s)
PY

cat > packages/db/tests/migrations.test.ts <<'EOF'
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  resolveMigrationsFolder,
  runDatabaseMigrations
} from "../src/migrations.js";

describe("startup database migrations", () => {
  it("runs the checked-in Drizzle migration journal", async () => {
    const runner = vi.fn(async () => {});

    await runDatabaseMigrations(
      {} as never,
      { runner }
    );

    expect(runner).toHaveBeenCalledWith(
      expect.anything(),
      {
        migrationsFolder:
          resolveMigrationsFolder()
      }
    );
  });

  it("fails closed when migration assets are missing", async () => {
    await expect(
      runDatabaseMigrations(
        {} as never,
        {
          migrationsFolder:
            "/definitely/missing/contribos-migrations",
          runner: vi.fn(async () => {})
        }
      )
    ).rejects.toThrow(
      "DATABASE_MIGRATIONS_NOT_FOUND"
    );
  });
});
EOF

echo
echo "== 11.3 Webhook retry and recovery =="

python3 <<'PY'
from pathlib import Path
p = Path("packages/db/src/schema.ts")
s = p.read_text()
old = '''    status: text("status")
      .notNull()
      .default("CLAIMED"),
    payload: jsonb("payload"),
'''
new = '''    status: text("status")
      .notNull()
      .default("CLAIMED"),
    attemptCount: integer("attempt_count")
      .notNull()
      .default(1),
    retryable: boolean("retryable")
      .notNull()
      .default(false),
    payload: jsonb("payload"),
'''
if old in s:
    s = s.replace(old, new)
elif 'attemptCount: integer("attempt_count")' not in s or 'retryable: boolean("retryable")' not in s:
    raise SystemExit("Could not locate webhook delivery status block.")
p.write_text(s)
PY

cat > packages/db/src/repositories/webhook-delivery-repository.ts <<'EOF'
import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  eq,
  inArray,
  lt,
  sql
} from "drizzle-orm";

import type { WebhookDeliveryStore } from "@contribos/github";

import type { ContribOSDatabase } from "../database.js";
import {
  webhookDeliveries,
  type WebhookDeliveryRow
} from "../schema.js";

const MAX_DELIVERY_ATTEMPTS = 3;

export interface RecordWebhookMetadataInput {
  deliveryId: string;
  eventName: string;
  action?: string | null;
  githubInstallationId?: string | null;
  githubRepositoryId?: string | null;
  payload?: unknown;
  receivedAt?: Date | null;
}

export interface RecoverStaleClaimsInput {
  staleBefore: Date;
  limit?: number;
}

export class WebhookDeliveryRepository
  implements WebhookDeliveryStore
{
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async tryClaim(
    deliveryId: string
  ): Promise<boolean> {
    const now = new Date();

    const inserted = await this.db
      .insert(webhookDeliveries)
      .values({
        id: randomUUID(),
        deliveryId,
        status: "CLAIMED",
        attemptCount: 1,
        retryable: false,
        claimedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing({
        target: webhookDeliveries.deliveryId
      })
      .returning({
        id: webhookDeliveries.id
      });

    if (inserted.length === 1) {
      return true;
    }

    const retried = await this.db
      .update(webhookDeliveries)
      .set({
        status: "CLAIMED",
        attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
        retryable: false,
        claimedAt: now,
        processedAt: null,
        errorCode: null,
        updatedAt: now
      })
      .where(
        and(
          eq(
            webhookDeliveries.deliveryId,
            deliveryId
          ),
          eq(
            webhookDeliveries.status,
            "FAILED"
          ),
          eq(
            webhookDeliveries.retryable,
            true
          ),
          lt(
            webhookDeliveries.attemptCount,
            MAX_DELIVERY_ATTEMPTS
          )
        )
      )
      .returning({
        id: webhookDeliveries.id
      });

    return retried.length === 1;
  }

  async hasProcessed(
    deliveryId: string
  ): Promise<boolean> {
    const row = await this.findByDeliveryId(
      deliveryId
    );

    return row?.status === "PROCESSED";
  }

  async findByDeliveryId(
    deliveryId: string
  ): Promise<WebhookDeliveryRow | null> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        eq(
          webhookDeliveries.deliveryId,
          deliveryId
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async markProcessed(
    deliveryId: string
  ): Promise<void> {
    const now = new Date();

    await this.db
      .update(webhookDeliveries)
      .set({
        status: "PROCESSED",
        processedAt: now,
        retryable: false,
        errorCode: null,
        updatedAt: now
      })
      .where(
        eq(
          webhookDeliveries.deliveryId,
          deliveryId
        )
      );
  }

  async markFailed(
    deliveryId: string,
    errorCode: string,
    retryable = false
  ): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        status: "FAILED",
        retryable,
        errorCode,
        updatedAt: new Date()
      })
      .where(
        eq(
          webhookDeliveries.deliveryId,
          deliveryId
        )
      );
  }

  async recordMetadata(
    input: RecordWebhookMetadataInput
  ): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        eventName: input.eventName,
        action: input.action ?? null,
        githubInstallationId:
          input.githubInstallationId ?? null,
        githubRepositoryId:
          input.githubRepositoryId ?? null,
        payload: input.payload ?? null,
        receivedAt: input.receivedAt ?? null,
        updatedAt: new Date()
      })
      .where(
        eq(
          webhookDeliveries.deliveryId,
          input.deliveryId
        )
      );
  }

  async recoverStaleClaims(
    input: RecoverStaleClaimsInput
  ): Promise<WebhookDeliveryRow[]> {
    const limit = input.limit ?? 100;

    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error(
        "recoverStaleClaims limit must be a positive integer."
      );
    }

    const candidates = await this.db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        and(
          eq(
            webhookDeliveries.status,
            "CLAIMED"
          ),
          lt(
            webhookDeliveries.claimedAt,
            input.staleBefore
          )
        )
      )
      .orderBy(
        asc(webhookDeliveries.claimedAt)
      )
      .limit(limit);

    if (candidates.length === 0) {
      return [];
    }

    return this.db
      .update(webhookDeliveries)
      .set({
        status: "FAILED",
        retryable: true,
        errorCode: "STALE_CLAIM",
        updatedAt: new Date()
      })
      .where(
        and(
          inArray(
            webhookDeliveries.id,
            candidates.map(({ id }) => id)
          ),
          eq(
            webhookDeliveries.status,
            "CLAIMED"
          ),
          lt(
            webhookDeliveries.claimedAt,
            input.staleBefore
          )
        )
      )
      .returning();
  }
}
EOF

cat > packages/db/tests/webhook-delivery-lifecycle.test.ts <<'EOF'
import {
  readFile,
  readdir
} from "node:fs/promises";
import {
  dirname,
  join
} from "node:path";
import {
  fileURLToPath
} from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  describe,
  expect,
  it
} from "vitest";

import * as schema from "../src/schema.js";
import {
  WebhookDeliveryRepository
} from "../src/repositories/webhook-delivery-repository.js";

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function findSql(
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findSql(path));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".sql")
    ) {
      files.push(path);
    }
  }

  return files.sort();
}

async function setup() {
  const client = await PGlite.create();

  for (
    const file of await findSql(
      join(packageRoot, "drizzle")
    )
  ) {
    await client.exec(
      await readFile(file, "utf8")
    );
  }

  return {
    client,
    db: drizzle(client, { schema })
  };
}

describe("WebhookDeliveryRepository lifecycle", () => {
  it("claims only once and distinguishes processed state", async () => {
    const { client, db } = await setup();

    try {
      const repository =
        new WebhookDeliveryRepository(
          db as any
        );

      expect(
        await repository.tryClaim(
          "delivery-1"
        )
      ).toBe(true);

      expect(
        await repository.tryClaim(
          "delivery-1"
        )
      ).toBe(false);

      await repository.markProcessed(
        "delivery-1"
      );

      expect(
        await repository.hasProcessed(
          "delivery-1"
        )
      ).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("reclaims retryable failures but caps attempts", async () => {
    const { client, db } = await setup();

    try {
      const repository =
        new WebhookDeliveryRepository(
          db as any
        );

      expect(
        await repository.tryClaim(
          "delivery-retry"
        )
      ).toBe(true);

      await repository.markFailed(
        "delivery-retry",
        "WEBHOOK_ENQUEUE_FAILED",
        true
      );

      expect(
        await repository.tryClaim(
          "delivery-retry"
        )
      ).toBe(true);

      await repository.markFailed(
        "delivery-retry",
        "WEBHOOK_ENQUEUE_FAILED",
        true
      );

      expect(
        await repository.tryClaim(
          "delivery-retry"
        )
      ).toBe(true);

      await repository.markFailed(
        "delivery-retry",
        "WEBHOOK_ENQUEUE_FAILED",
        true
      );

      expect(
        await repository.tryClaim(
          "delivery-retry"
        )
      ).toBe(false);

      expect(
        await repository.findByDeliveryId(
          "delivery-retry"
        )
      ).toMatchObject({
        status: "FAILED",
        attemptCount: 3,
        retryable: true
      });
    } finally {
      await client.close();
    }
  });

  it("does not reclaim permanent failures", async () => {
    const { client, db } = await setup();

    try {
      const repository =
        new WebhookDeliveryRepository(
          db as any
        );

      await repository.tryClaim(
        "delivery-permanent"
      );
      await repository.markFailed(
        "delivery-permanent",
        "NORMALIZATION_FAILED",
        false
      );

      expect(
        await repository.tryClaim(
          "delivery-permanent"
        )
      ).toBe(false);
    } finally {
      await client.close();
    }
  });

  it("marks stale claims retryable", async () => {
    const { client, db } = await setup();

    try {
      const repository =
        new WebhookDeliveryRepository(
          db as any
        );

      await repository.tryClaim(
        "delivery-stale"
      );

      const recovered =
        await repository.recoverStaleClaims({
          staleBefore: new Date(
            Date.now() + 60_000
          )
        });

      expect(recovered).toHaveLength(1);
      expect(recovered[0]).toMatchObject({
        status: "FAILED",
        errorCode: "STALE_CLAIM",
        retryable: true
      });
    } finally {
      await client.close();
    }
  });
});
EOF

echo
echo "== 11.4 Scheduler overlap and graceful shutdown =="

cat > apps/control-plane/src/sweep-scheduler.ts <<'EOF'
import {
  InstallationRepository,
  type ContribOSDatabase,
  type InstallationRow
} from "@contribos/db";

import type {
  RuntimeLogger
} from "./logger.js";
import type {
  ReconciliationSweepProducer
} from "./sweep-producer.js";

export interface InstallationListStore {
  listAll(): Promise<InstallationRow[]>;
}

export interface SweepSchedulerOptions {
  intervalMs: number;
  installations?: InstallationListStore;
}

export class SweepScheduler {
  private timer: NodeJS.Timeout | null = null;
  private activeRun: Promise<number> | null = null;
  private readonly installations:
    InstallationListStore;

  constructor(
    db: ContribOSDatabase,
    private readonly producer:
      ReconciliationSweepProducer,
    private readonly logger:
      RuntimeLogger,
    private readonly options:
      SweepSchedulerOptions
  ) {
    this.installations =
      options.installations ??
      new InstallationRepository(db);
  }

  private async executeOnce(): Promise<number> {
    const installations =
      await this.installations.listAll();

    let enqueued = 0;

    for (const installation of installations) {
      const githubId = Number(
        installation.githubInstallationId
      );

      if (
        !Number.isSafeInteger(githubId) ||
        githubId <= 0
      ) {
        this.logger.warn(
          "sweep.installation.invalid",
          { installationId: installation.id }
        );
        continue;
      }

      if (
        await this.producer.enqueue({
          installationId: githubId
        })
      ) {
        enqueued += 1;
      }
    }

    this.logger.info(
      "sweep.completed",
      { enqueued }
    );

    return enqueued;
  }

  runOnce(): Promise<number> {
    if (this.activeRun) {
      this.logger.warn(
        "sweep.skipped_overlap"
      );
      return Promise.resolve(0);
    }

    const run = this.executeOnce();
    this.activeRun = run;

    const clearActiveRun = () => {
      if (this.activeRun === run) {
        this.activeRun = null;
      }
    };

    void run.then(
      clearActiveRun,
      clearActiveRun
    );

    return run;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(
      () => {
        void this.runOnce().catch((error) => {
          this.logger.error(
            "sweep.failed",
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown failure."
            }
          );
        });
      },
      this.options.intervalMs
    );
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async stopAndWait(): Promise<void> {
    this.stop();

    const activeRun = this.activeRun;

    if (activeRun) {
      await activeRun;
    }
  }
}
EOF

cat > apps/control-plane/src/application-runtime.ts <<'EOF'
import {
  WorkerLoop,
  WorkerRunner,
  type JobStore
} from "@contribos/worker";

import {
  ApplicationJobHandler,
  type PullRequestJobExecutor,
  type SweepJobExecutor
} from "./application-job-handler.js";
import {
  RuntimeHealth
} from "./health.js";
import type {
  RuntimeLogger
} from "./logger.js";
import {
  ReconciliationSweepProducer
} from "./sweep-producer.js";
import {
  WebhookApplicationService
} from "./webhook-application-service.js";

export interface ApplicationRuntimeOptions {
  store: JobStore;
  pullRequests:
    PullRequestJobExecutor;
  sweeps: SweepJobExecutor;
  logger: RuntimeLogger;
  workerPollIntervalMs?: number;
}

export class ApplicationRuntime {
  readonly health =
    new RuntimeHealth();

  readonly webhooks:
    WebhookApplicationService;

  readonly sweepProducer:
    ReconciliationSweepProducer;

  readonly runner:
    WorkerRunner;

  readonly loop:
    WorkerLoop;

  private workerPromise:
    Promise<void> | null = null;

  constructor(
    private readonly options:
      ApplicationRuntimeOptions
  ) {
    const handler =
      new ApplicationJobHandler(
        options.pullRequests,
        options.sweeps
      );

    this.webhooks =
      new WebhookApplicationService(
        options.store
      );

    this.sweepProducer =
      new ReconciliationSweepProducer(
        options.store
      );

    this.runner =
      new WorkerRunner(
        options.store,
        handler,
        {
          observer: {
            jobClaimed: (job) =>
              options.logger.info(
                "worker.job.claimed",
                {
                  jobId: job.id,
                  type: job.type
                }
              ),
            jobCompleted: (job) =>
              options.logger.info(
                "worker.job.completed",
                {
                  jobId: job.id,
                  type: job.type
                }
              ),
            jobRescheduled: (
              job,
              nextAttempt,
              availableAt,
              errorCode,
              errorMessage
            ) =>
              options.logger.warn(
                "worker.job.rescheduled",
                {
                  jobId: job.id,
                  type: job.type,
                  nextAttempt,
                  availableAt:
                    availableAt
                      .toISOString(),
                  errorCode,
                  errorMessage
                }
              ),
            jobDead: (
              job,
              errorCode,
              errorMessage
            ) =>
              options.logger.error(
                "worker.job.dead",
                {
                  jobId: job.id,
                  type: job.type,
                  errorCode,
                  errorMessage
                }
              )
          }
        }
      );

    this.loop =
      new WorkerLoop(
        this.runner,
        {
          pollIntervalMs:
            options
              .workerPollIntervalMs ??
            1_000
        }
      );
  }

  markReady(): void {
    this.health.markReady();

    this.options.logger.info(
      "runtime.ready"
    );
  }

  startWorker(): Promise<void> {
    if (this.workerPromise) {
      return this.workerPromise;
    }

    const run = this.loop.run();
    this.workerPromise = run;

    const clearWorker = () => {
      if (this.workerPromise === run) {
        this.workerPromise = null;
      }
    };

    void run.then(
      clearWorker,
      clearWorker
    );

    return run;
  }

  requestShutdown(): void {
    if (
      this.health.snapshot()
        .shuttingDown
    ) {
      return;
    }

    this.health.beginShutdown();
    this.loop.requestStop();

    this.options.logger.info(
      "runtime.shutdown.requested"
    );
  }

  async stopAndWait(): Promise<void> {
    this.requestShutdown();

    const worker = this.workerPromise;

    if (worker) {
      await worker;
    }
  }
}
EOF

python3 <<'PY'
from pathlib import Path
p = Path("apps/control-plane/src/runtime-factory.ts")
s = p.read_text()
old = '''    async close() {
      runtime.requestShutdown();
      tokenProvider.clear();
      await database.close();
    }
'''
new = '''    async close() {
      await runtime.stopAndWait();
      tokenProvider.clear();
      await database.close();
    }
'''
if old in s:
    s = s.replace(old, new)
elif 'await runtime.stopAndWait();' not in s:
    raise SystemExit("Could not locate runtime close block.")
p.write_text(s)
PY

cat > apps/control-plane/tests/sweep-scheduler.test.ts <<'EOF'
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  SweepScheduler
} from "../src/sweep-scheduler.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

describe("SweepScheduler", () => {
  it("prevents overlapping sweep runs", async () => {
    const gate = deferred<boolean>();
    const warn = vi.fn();

    const scheduler = new SweepScheduler(
      {} as never,
      {
        enqueue: vi.fn(
          async () => gate.promise
        )
      } as never,
      {
        info: vi.fn(),
        warn,
        error: vi.fn()
      },
      {
        intervalMs: 10,
        installations: {
          listAll: async () => [
            {
              id: "installation-1",
              githubInstallationId: "10",
              accountLogin: "example",
              accountType: "User",
              permissions: {},
              repositorySelection: "selected",
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        }
      }
    );

    const first = scheduler.runOnce();
    await Promise.resolve();

    await expect(
      scheduler.runOnce()
    ).resolves.toBe(0);

    expect(warn).toHaveBeenCalledWith(
      "sweep.skipped_overlap"
    );

    gate.resolve(true);

    await expect(first).resolves.toBe(1);
  });
});
EOF

cat > apps/control-plane/tests/application-runtime-shutdown.test.ts <<'EOF'
import {
  describe,
  expect,
  it
} from "vitest";

import type {
  NormalizedGitHubWebhookEvent
} from "@contribos/github";
import {
  InMemoryJobStore
} from "@contribos/worker";

import {
  ApplicationRuntime
} from "../src/application-runtime.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

describe("ApplicationRuntime shutdown", () => {
  it("waits for an active worker job before shutdown completes", async () => {
    const store = new InMemoryJobStore();
    const started = deferred();
    const release = deferred();

    const runtime = new ApplicationRuntime({
      store,
      pullRequests: {
        async execute() {
          started.resolve();
          await release.promise;
        }
      },
      sweeps: {
        async execute() {}
      },
      logger: {
        info() {},
        warn() {},
        error() {}
      },
      workerPollIntervalMs: 1
    });

    const event:
      NormalizedGitHubWebhookEvent = {
        deliveryId: "delivery-shutdown",
        eventName: "pull_request",
        action: "synchronize",
        installationId: 10,
        repositoryId: 20,
        objectType: "PULL_REQUEST",
        objectId: "100",
        objectUrl:
          "https://example.test/pr/42",
        contributionNumber: 42,
        headSha: "abc123",
        occurredAt: new Date()
      };

    await runtime.webhooks
      .acceptNormalizedEvent(event);

    void runtime.startWorker();
    await started.promise;

    let stopped = false;
    const shutdown = runtime
      .stopAndWait()
      .then(() => {
        stopped = true;
      });

    await Promise.resolve();
    expect(stopped).toBe(false);

    release.resolve();
    await shutdown;

    expect(stopped).toBe(true);
    expect(
      runtime.health.snapshot()
    ).toMatchObject({
      ready: false,
      shuttingDown: true
    });
  });
});
EOF

echo
echo "== 11.5 Atomic reconciliation persistence =="

cat > packages/db/src/persist-reconciliation.ts <<'EOF'
import { randomUUID } from "node:crypto";

import {
  desc,
  eq
} from "drizzle-orm";

import type {
  StateEvaluation
} from "@contribos/domain";
import type {
  PullRequestReconciliationResult
} from "@contribos/github";

import type {
  ContribOSDatabase
} from "./database.js";
import {
  contributions,
  evidence,
  reconciliationRuns,
  stateEvaluations,
  stateHistory
} from "./schema.js";

export interface PersistReconciliationInput {
  repositoryId: string;
  pullRequestNumber: number;
  reconciliation:
    PullRequestReconciliationResult;
  evaluation: StateEvaluation;
  startedAt: Date;
  completedAt: Date;
}

export interface PersistReconciliationResult {
  contributionId: string;
  evaluationId: string;
  stateChanged: boolean;
}

export async function persistReconciliationTransaction(
  db: ContribOSDatabase,
  input: PersistReconciliationInput
): Promise<PersistReconciliationResult> {
  const record = input.reconciliation.record;
  const snapshot = input.reconciliation.snapshot;

  if (!record || !snapshot) {
    throw new Error(
      "Stable reconciliation data is required for persistence."
    );
  }

  return db.transaction(async (tx) => {
    const now = new Date();

    const contributionRows = await tx
      .insert(contributions)
      .values({
        id: randomUUID(),
        repositoryId: input.repositoryId,
        githubPullRequestId:
          record.pullRequestId,
        pullRequestNumber:
          input.pullRequestNumber,
        url: record.url,
        headSha: record.headSha,
        latestSnapshot: snapshot,
        lastReconciledAt:
          input.reconciliation.reconciledAt,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [
          contributions.repositoryId,
          contributions.pullRequestNumber
        ],
        set: {
          githubPullRequestId:
            record.pullRequestId,
          url: record.url,
          headSha: record.headSha,
          latestSnapshot: snapshot,
          lastReconciledAt:
            input.reconciliation.reconciledAt,
          updatedAt: now
        }
      })
      .returning({
        id: contributions.id
      });

    const contribution =
      contributionRows[0];

    if (!contribution) {
      throw new Error(
        "RECONCILIATION_CONTRIBUTION_UPSERT_FAILED"
      );
    }

    const previousRows = await tx
      .select({
        workflowState:
          stateEvaluations.workflowState
      })
      .from(stateEvaluations)
      .where(
        eq(
          stateEvaluations.contributionId,
          contribution.id
        )
      )
      .orderBy(
        desc(stateEvaluations.evaluatedAt),
        desc(stateEvaluations.createdAt)
      )
      .limit(1);

    const previousWorkflowState =
      previousRows[0]?.workflowState ??
      null;

    for (
      const ref of
      input.reconciliation.evidence
    ) {
      await tx
        .insert(evidence)
        .values({
          id: randomUUID(),
          contributionId:
            contribution.id,
          evidenceId: ref.id,
          source: ref.source,
          objectType: ref.objectType,
          externalId: ref.externalId,
          url: ref.url,
          occurredAt: ref.occurredAt,
          capturedAt: now,
          createdAt: now
        })
        .onConflictDoUpdate({
          target: evidence.evidenceId,
          set: {
            contributionId:
              contribution.id,
            source: ref.source,
            objectType: ref.objectType,
            externalId: ref.externalId,
            url: ref.url,
            occurredAt: ref.occurredAt,
            capturedAt: now
          }
        });
    }

    await tx
      .insert(reconciliationRuns)
      .values({
        id: randomUUID(),
        contributionId:
          contribution.id,
        status:
          input.reconciliation.status,
        reasonCode:
          input.reconciliation.reasonCode,
        headSha:
          input.reconciliation.headSha,
        repairAction:
          input.reconciliation
            .repairDecision.action,
        driftFields:
          input.reconciliation
            .drift?.fields ?? [],
        result: input.reconciliation,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        createdAt: now
      });

    const evaluationId = randomUUID();

    await tx
      .insert(stateEvaluations)
      .values({
        id: evaluationId,
        contributionId:
          contribution.id,
        workflowState:
          input.evaluation.workflowState,
        nextActor:
          input.evaluation.nextActor,
        readiness:
          input.evaluation.readiness,
        reasonCode:
          input.evaluation.reasonCode,
        explanation:
          input.evaluation.explanation,
        engineVersion:
          input.evaluation.engineVersion,
        evaluatedAt:
          input.evaluation.evaluatedAt,
        evaluation: input.evaluation,
        createdAt: now
      });

    const stateChanged =
      previousWorkflowState !==
      input.evaluation.workflowState;

    if (stateChanged) {
      await tx
        .insert(stateHistory)
        .values({
          id: randomUUID(),
          contributionId:
            contribution.id,
          evaluationId,
          fromState:
            previousWorkflowState,
          toState:
            input.evaluation.workflowState,
          reasonCode:
            input.evaluation.reasonCode,
          changedAt:
            input.evaluation.evaluatedAt,
          createdAt: now
        });
    }

    return {
      contributionId:
        contribution.id,
      evaluationId,
      stateChanged
    };
  });
}
EOF

cat > apps/control-plane/src/reconciliation-executor.ts <<'EOF'
import type {
  PullRequestSnapshot
} from "@contribos/domain";
import {
  ContributionRepository,
  RepositoryRepository,
  persistReconciliationTransaction,
  type ContribOSDatabase
} from "@contribos/db";
import {
  reconcilePullRequest,
  type GitHubApiRequester
} from "@contribos/github";
import {
  evaluatePullRequest
} from "@contribos/state-engine";
import type {
  ReconcilePullRequestJobPayload
} from "@contribos/worker";

import type {
  PullRequestJobExecutor
} from "./application-job-handler.js";

export class ReconciliationRetryError
  extends Error
{
  readonly code: string;

  constructor(
    message: string,
    code = "RECONCILIATION_RETRY_REQUIRED"
  ) {
    super(message);
    this.name =
      "ReconciliationRetryError";
    this.code = code;
  }
}

export class DatabaseBackedPullRequestExecutor
  implements PullRequestJobExecutor
{
  private readonly repositories:
    RepositoryRepository;
  private readonly contributions:
    ContributionRepository;

  constructor(
    private readonly db:
      ContribOSDatabase,
    private readonly github:
      GitHubApiRequester
  ) {
    this.repositories =
      new RepositoryRepository(db);
    this.contributions =
      new ContributionRepository(db);
  }

  async execute(
    payload: ReconcilePullRequestJobPayload
  ): Promise<void> {
    const repository =
      await this.repositories
        .findByGitHubRepositoryId(
          String(payload.repositoryId)
        );

    if (!repository) {
      const error = new Error(
        "Repository is not registered in ContribOS."
      ) as Error & { code: string };

      error.code =
        "REPOSITORY_NOT_REGISTERED";
      throw error;
    }

    const existing =
      await this.contributions
        .findByRepositoryAndNumber(
          repository.id,
          payload.pullRequestNumber
        );

    const observedSnapshot =
      existing?.latestSnapshot &&
      typeof existing.latestSnapshot ===
        "object"
        ? existing.latestSnapshot as
            PullRequestSnapshot
        : undefined;

    const startedAt = new Date();

    const reconciliation =
      await reconcilePullRequest(
        this.github,
        {
          installationId:
            payload.installationId,
          repositoryId:
            payload.repositoryId,
          owner: repository.owner,
          repository:
            repository.name,
          pullRequestNumber:
            payload.pullRequestNumber,
          ...(observedSnapshot
            ? { observedSnapshot }
            : {})
        }
      );

    if (
      reconciliation.status ===
      "RETRY_REQUIRED"
    ) {
      throw new ReconciliationRetryError(
        reconciliation.reasonCode,
        reconciliation.reasonCode
      );
    }

    if (
      !reconciliation.snapshot ||
      !reconciliation.record
    ) {
      throw new Error(
        "Reconciliation completed without a stable pull request record."
      );
    }

    const evaluation =
      evaluatePullRequest(
        reconciliation.snapshot
      );

    await persistReconciliationTransaction(
      this.db,
      {
        repositoryId: repository.id,
        pullRequestNumber:
          payload.pullRequestNumber,
        reconciliation,
        evaluation,
        startedAt,
        completedAt: new Date()
      }
    );
  }
}
EOF

cat > packages/db/tests/persist-reconciliation-atomicity.test.ts <<'EOF'
import {
  readFile,
  readdir
} from "node:fs/promises";
import {
  dirname,
  join
} from "node:path";
import {
  fileURLToPath
} from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  describe,
  expect,
  it
} from "vitest";

import * as schema from "../src/schema.js";
import {
  persistReconciliationTransaction
} from "../src/persist-reconciliation.js";

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function findSql(
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findSql(path));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".sql")
    ) {
      files.push(path);
    }
  }

  return files.sort();
}

async function setup() {
  const client = await PGlite.create();

  for (
    const file of await findSql(
      join(packageRoot, "drizzle")
    )
  ) {
    await client.exec(
      await readFile(file, "utf8")
    );
  }

  const installationId =
    "11111111-1111-4111-8111-111111111111";
  const repositoryId =
    "22222222-2222-4222-8222-222222222222";

  await client.query(
    `
      INSERT INTO installations (
        id,
        github_installation_id,
        permissions
      ) VALUES ($1, $2, $3::jsonb)
    `,
    [installationId, "10", "{}"]
  );

  await client.query(
    `
      INSERT INTO repositories (
        id,
        installation_id,
        github_repository_id,
        owner,
        name,
        full_name,
        is_private
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
    `,
    [
      repositoryId,
      installationId,
      "20",
      "example",
      "repo",
      "example/repo",
      false
    ]
  );

  return {
    client,
    repositoryId,
    db: drizzle(client, { schema })
  };
}

function reconciliation(
  at: Date
) {
  return {
    status: "STABLE",
    reasonCode: "STABLE",
    headSha: "abc123",
    reconciledAt: at,
    record: {
      pullRequestId: "9001",
      url:
        "https://github.com/example/repo/pull/42",
      headSha: "abc123"
    },
    snapshot: {
      evidence: [],
      isDraft: false,
      isOpen: true,
      isMerged: false,
      hasMergeConflict: false,
      checkStatus: "SUCCESS",
      reviewDecision: "APPROVED",
      authorHasChangesToMake: false,
      maintainerReviewRequired: false
    },
    evidence: [],
    repairDecision: {
      action: "NONE"
    },
    drift: null
  } as any;
}

function evaluation(
  workflowState: string,
  at: Date
) {
  return {
    workflowState,
    nextActor: "MAINTAINER",
    readiness: "READY_TO_MERGE",
    reasonCode: workflowState,
    explanation: workflowState,
    engineVersion: "test",
    evaluatedAt: at,
    evidence: []
  } as any;
}

describe("atomic reconciliation persistence", () => {
  it("rolls back the contribution upsert when a later write fails", async () => {
    const {
      client,
      db,
      repositoryId
    } = await setup();

    try {
      await client.exec(`
        ALTER TABLE state_evaluations
        ADD CONSTRAINT reject_failure_test
        CHECK (workflow_state <> 'FAIL_TEST');
      `);

      const at = new Date(
        "2026-09-02T00:00:00Z"
      );

      await expect(
        persistReconciliationTransaction(
          db as any,
          {
            repositoryId,
            pullRequestNumber: 42,
            reconciliation:
              reconciliation(at),
            evaluation:
              evaluation(
                "FAIL_TEST",
                at
              ),
            startedAt: at,
            completedAt: at
          }
        )
      ).rejects.toThrow();

      const rows = await client.query<{
        count: string;
      }>(
        "SELECT COUNT(*)::text AS count FROM contributions"
      );

      expect(
        Number(rows.rows[0]?.count)
      ).toBe(0);
    } finally {
      await client.close();
    }
  });

  it("records history only when deterministic workflow state changes", async () => {
    const {
      client,
      db,
      repositoryId
    } = await setup();

    try {
      const firstAt = new Date(
        "2026-09-02T00:00:00Z"
      );
      const secondAt = new Date(
        "2026-09-02T00:01:00Z"
      );
      const thirdAt = new Date(
        "2026-09-02T00:02:00Z"
      );

      await persistReconciliationTransaction(
        db as any,
        {
          repositoryId,
          pullRequestNumber: 42,
          reconciliation:
            reconciliation(firstAt),
          evaluation:
            evaluation(
              "IN_REVIEW",
              firstAt
            ),
          startedAt: firstAt,
          completedAt: firstAt
        }
      );

      await persistReconciliationTransaction(
        db as any,
        {
          repositoryId,
          pullRequestNumber: 42,
          reconciliation:
            reconciliation(secondAt),
          evaluation:
            evaluation(
              "READY_TO_MERGE",
              secondAt
            ),
          startedAt: secondAt,
          completedAt: secondAt
        }
      );

      await persistReconciliationTransaction(
        db as any,
        {
          repositoryId,
          pullRequestNumber: 42,
          reconciliation:
            reconciliation(thirdAt),
          evaluation:
            evaluation(
              "READY_TO_MERGE",
              thirdAt
            ),
          startedAt: thirdAt,
          completedAt: thirdAt
        }
      );

      const history = await client.query<{
        from_state: string | null;
        to_state: string;
      }>(`
        SELECT from_state, to_state
        FROM state_history
        ORDER BY changed_at ASC
      `);

      expect(history.rows).toEqual([
        {
          from_state: null,
          to_state: "IN_REVIEW"
        },
        {
          from_state: "IN_REVIEW",
          to_state: "READY_TO_MERGE"
        }
      ]);
    } finally {
      await client.close();
    }
  });
});
EOF

echo
echo "== 11.6 OAuth refresh and session hardening =="

python3 <<'PY'
from pathlib import Path
p = Path("packages/db/src/repositories/auth-user-repository.ts")
s = p.read_text()
if "export interface UpdateGitHubUserCredentialsInput" not in s:
    anchor = '''export interface UpsertGitHubUserInput {
  providerUserId: string;
  login: string;
  avatarUrl: string | null;
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt:
    Date | null;
  githubRefreshTokenCiphertext:
    string | null;
  githubRefreshTokenExpiresAt:
    Date | null;
}
'''
    addition = anchor + '''\nexport interface UpdateGitHubUserCredentialsInput {
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt: Date | null;
  githubRefreshTokenCiphertext: string | null;
  githubRefreshTokenExpiresAt: Date | null;
}\n'''
    if anchor not in s:
        raise SystemExit("Could not locate UpsertGitHubUserInput.")
    s = s.replace(anchor, addition)

if "async updateGitHubCredentials(" not in s:
    marker = '''  async findById(
    id: string
  ): Promise<AuthUserRow | null> {
'''
    method = '''  async updateGitHubCredentials(
    id: string,
    input: UpdateGitHubUserCredentialsInput
  ): Promise<AuthUserRow> {
    const rows = await this.db
      .update(authUsers)
      .set({
        githubAccessTokenCiphertext:
          input.githubAccessTokenCiphertext,
        githubAccessTokenExpiresAt:
          input.githubAccessTokenExpiresAt,
        githubRefreshTokenCiphertext:
          input.githubRefreshTokenCiphertext,
        githubRefreshTokenExpiresAt:
          input.githubRefreshTokenExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(authUsers.id, id))
      .returning();

    const user = rows[0];

    if (!user) {
      throw new Error(
        "AUTH_USER_CREDENTIAL_UPDATE_FAILED"
      );
    }

    return user;
  }

'''
    if marker not in s:
        raise SystemExit("Could not locate AuthUserRepository findById anchor.")
    s = s.replace(marker, method + marker)
p.write_text(s)
PY

cat > apps/control-plane/src/security/github-oauth-client.ts <<'EOF'
const GITHUB_AUTHORIZE_URL =
  "https://github.com/login/oauth/authorize";

const GITHUB_TOKEN_URL =
  "https://github.com/login/oauth/access_token";

const GITHUB_USER_URL =
  "https://api.github.com/user";

const GITHUB_API_VERSION =
  "2026-03-10";

export interface GitHubOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  fetchFn?: typeof fetch;
}

export interface GitHubOAuthToken {
  accessToken: string;
  accessTokenExpiresAt: Date | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

export interface GitHubOAuthViewer {
  id: number;
  login: string;
  avatarUrl: string | null;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

interface UserResponse {
  id?: number;
  login?: string;
  avatar_url?: string | null;
}

function expiresAt(
  seconds: number | undefined,
  now: Date
): Date | null {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  return new Date(
    now.getTime() +
      seconds * 1000
  );
}

export class GitHubOAuthClient {
  private readonly fetchFn:
    typeof fetch;

  constructor(
    private readonly options:
      GitHubOAuthClientOptions
  ) {
    this.fetchFn =
      options.fetchFn ?? fetch;
  }

  authorizationUrl(
    state: string
  ): string {
    const url = new URL(
      GITHUB_AUTHORIZE_URL
    );

    url.searchParams.set(
      "client_id",
      this.options.clientId
    );
    url.searchParams.set(
      "redirect_uri",
      this.options.callbackUrl
    );
    url.searchParams.set(
      "state",
      state
    );

    return url.toString();
  }

  private async requestToken(
    body: URLSearchParams,
    now: Date
  ): Promise<GitHubOAuthToken> {
    const response = await this.fetchFn(
      GITHUB_TOKEN_URL,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type":
            "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const payload =
      await response.json() as
        TokenResponse;

    if (
      !response.ok ||
      !payload.access_token
    ) {
      throw new Error(
        payload.error ??
          "GITHUB_OAUTH_TOKEN_EXCHANGE_FAILED"
      );
    }

    return {
      accessToken:
        payload.access_token,
      accessTokenExpiresAt:
        expiresAt(
          payload.expires_in,
          now
        ),
      refreshToken:
        payload.refresh_token ??
        null,
      refreshTokenExpiresAt:
        expiresAt(
          payload.refresh_token_expires_in,
          now
        )
    };
  }

  async exchangeCode(
    code: string,
    now = new Date()
  ): Promise<GitHubOAuthToken> {
    return this.requestToken(
      new URLSearchParams({
        client_id:
          this.options.clientId,
        client_secret:
          this.options.clientSecret,
        code,
        redirect_uri:
          this.options.callbackUrl
      }),
      now
    );
  }

  async refreshAccessToken(
    refreshToken: string,
    now = new Date()
  ): Promise<GitHubOAuthToken> {
    if (!refreshToken.trim()) {
      throw new Error(
        "GITHUB_OAUTH_REFRESH_TOKEN_REQUIRED"
      );
    }

    return this.requestToken(
      new URLSearchParams({
        client_id:
          this.options.clientId,
        client_secret:
          this.options.clientSecret,
        grant_type:
          "refresh_token",
        refresh_token:
          refreshToken
      }),
      now
    );
  }

  async fetchViewer(
    accessToken: string
  ): Promise<GitHubOAuthViewer> {
    const response =
      await this.fetchFn(
        GITHUB_USER_URL,
        {
          method: "GET",
          headers: {
            accept:
              "application/vnd.github+json",
            authorization:
              `Bearer ${accessToken}`,
            "x-github-api-version":
              GITHUB_API_VERSION,
            "user-agent":
              "ContribOS"
          }
        }
      );

    const payload =
      await response.json() as
        UserResponse;

    if (
      !response.ok ||
      typeof payload.id !==
        "number" ||
      !payload.login
    ) {
      throw new Error(
        "GITHUB_OAUTH_USER_LOOKUP_FAILED"
      );
    }

    return {
      id: payload.id,
      login: payload.login,
      avatarUrl:
        payload.avatar_url ?? null
    };
  }
}
EOF

cat > apps/control-plane/src/security/auth-service.ts <<'EOF'
import type {
  AuthSessionRow,
  AuthUserRow,
  CreateAuthSessionInput,
  CreateOAuthStateInput,
  UpdateGitHubUserCredentialsInput,
  UpsertGitHubUserInput
} from "@contribos/db";

import type {
  AuthenticatedPrincipal,
  ResolvedAuthContext
} from "./auth-types.js";
import {
  decryptCredential,
  encryptCredential
} from "./credential-cipher.js";
import type {
  GitHubOAuthClient,
  GitHubOAuthToken,
  GitHubOAuthViewer
} from "./github-oauth-client.js";
import {
  buildOAuthStateCookie,
  buildOAuthStateDeletionCookie
} from "./oauth-state-cookie.js";
import {
  createOAuthState,
  hashOAuthState,
  oauthStatesMatch
} from "./oauth-state.js";
import {
  buildSessionCookie,
  buildSessionDeletionCookie
} from "./session-cookie.js";
import {
  createSessionToken,
  hashSessionToken
} from "./session-token.js";

const SESSION_TOUCH_INTERVAL_MS =
  5 * 60 * 1000;

export interface AuthUserStore {
  upsertGitHubUser(
    input: UpsertGitHubUserInput
  ): Promise<AuthUserRow>;

  updateGitHubCredentials?(
    id: string,
    input:
      UpdateGitHubUserCredentialsInput
  ): Promise<AuthUserRow>;
}

export interface AuthSessionStore {
  create(
    input: CreateAuthSessionInput
  ): Promise<AuthSessionRow>;

  findActiveByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<{
    session: AuthSessionRow;
    user: AuthUserRow;
  } | null>;

  revokeByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<boolean>;

  touch?(
    id: string,
    now?: Date
  ): Promise<void>;
}

export interface OAuthStateStore {
  create(
    input: CreateOAuthStateInput
  ): Promise<unknown>;

  consume(
    stateHash: string,
    now?: Date
  ): Promise<unknown | null>;
}

export interface AuthServiceOptions {
  oauth: GitHubOAuthClient;
  users: AuthUserStore;
  sessions: AuthSessionStore;
  oauthStates: OAuthStateStore;
  credentialEncryptionKey: string;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  oauthStateTtlSeconds: number;
}

export interface BeginLoginResult {
  authorizationUrl: string;
  stateCookie: string;
}

export interface CompleteLoginInput {
  code: string;
  callbackState: string;
  cookieState: string;
}

export interface CompleteLoginResult {
  principal: AuthenticatedPrincipal;
  sessionCookie: string;
  clearStateCookie: string;
}

function encryptedUserInput(
  token: GitHubOAuthToken,
  viewer: GitHubOAuthViewer,
  key: string
): UpsertGitHubUserInput {
  return {
    providerUserId:
      String(viewer.id),
    login: viewer.login,
    avatarUrl: viewer.avatarUrl,
    githubAccessTokenCiphertext:
      encryptCredential(
        token.accessToken,
        key
      ),
    githubAccessTokenExpiresAt:
      token.accessTokenExpiresAt,
    githubRefreshTokenCiphertext:
      token.refreshToken
        ? encryptCredential(
            token.refreshToken,
            key
          )
        : null,
    githubRefreshTokenExpiresAt:
      token.refreshTokenExpiresAt
  };
}

function refreshTokenUsable(
  user: AuthUserRow,
  now: Date
): boolean {
  if (!user.githubRefreshTokenCiphertext) {
    return false;
  }

  return (
    !user.githubRefreshTokenExpiresAt ||
    user.githubRefreshTokenExpiresAt
      .getTime() > now.getTime()
  );
}

export class AuthService {
  constructor(
    private readonly options:
      AuthServiceOptions
  ) {}

  async beginLogin(
    now = new Date()
  ): Promise<BeginLoginResult> {
    const state = createOAuthState();

    await this.options.oauthStates.create({
      stateHash:
        hashOAuthState(state),
      expiresAt: new Date(
        now.getTime() +
          this.options
            .oauthStateTtlSeconds *
            1000
      )
    });

    return {
      authorizationUrl:
        this.options.oauth
          .authorizationUrl(state),
      stateCookie:
        buildOAuthStateCookie(
          state,
          {
            secure:
              this.options
                .secureCookies,
            maxAgeSeconds:
              this.options
                .oauthStateTtlSeconds
          }
        )
    };
  }

  async completeLogin(
    input: CompleteLoginInput,
    now = new Date()
  ): Promise<CompleteLoginResult> {
    if (
      !oauthStatesMatch(
        input.callbackState,
        input.cookieState
      )
    ) {
      throw new Error(
        "OAUTH_STATE_MISMATCH"
      );
    }

    const consumed =
      await this.options
        .oauthStates
        .consume(
          hashOAuthState(
            input.callbackState
          ),
          now
        );

    if (!consumed) {
      throw new Error(
        "OAUTH_STATE_INVALID_OR_EXPIRED"
      );
    }

    const token =
      await this.options.oauth
        .exchangeCode(
          input.code,
          now
        );

    const viewer =
      await this.options.oauth
        .fetchViewer(
          token.accessToken
        );

    const user =
      await this.options.users
        .upsertGitHubUser(
          encryptedUserInput(
            token,
            viewer,
            this.options
              .credentialEncryptionKey
          )
        );

    const sessionToken =
      createSessionToken();

    await this.options.sessions.create({
      userId: user.id,
      tokenHash:
        sessionToken.tokenHash,
      expiresAt: new Date(
        now.getTime() +
          this.options
            .sessionTtlSeconds *
            1000
      )
    });

    return {
      principal: {
        provider: "GITHUB",
        providerUserId:
          user.providerUserId,
        login: user.login
      },
      sessionCookie:
        buildSessionCookie(
          sessionToken.token,
          {
            secure:
              this.options
                .secureCookies,
            maxAgeSeconds:
              this.options
                .sessionTtlSeconds
          }
        ),
      clearStateCookie:
        buildOAuthStateDeletionCookie(
          this.options
            .secureCookies
        )
    };
  }

  private async refreshUserCredential(
    user: AuthUserRow,
    now: Date
  ): Promise<AuthUserRow> {
    const expiresAt =
      user.githubAccessTokenExpiresAt;

    if (
      !expiresAt ||
      expiresAt.getTime() >
        now.getTime()
    ) {
      return user;
    }

    if (
      !refreshTokenUsable(user, now) ||
      !this.options.users
        .updateGitHubCredentials
    ) {
      return user;
    }

    try {
      const refreshToken =
        decryptCredential(
          user.githubRefreshTokenCiphertext!,
          this.options
            .credentialEncryptionKey
        );

      const refreshed =
        await this.options.oauth
          .refreshAccessToken(
            refreshToken,
            now
          );

      const nextRefreshCiphertext =
        refreshed.refreshToken
          ? encryptCredential(
              refreshed.refreshToken,
              this.options
                .credentialEncryptionKey
            )
          : user
              .githubRefreshTokenCiphertext;

      const nextRefreshExpiresAt =
        refreshed.refreshToken
          ? refreshed
              .refreshTokenExpiresAt
          : user
              .githubRefreshTokenExpiresAt;

      return await this.options.users
        .updateGitHubCredentials(
          user.id,
          {
            githubAccessTokenCiphertext:
              encryptCredential(
                refreshed.accessToken,
                this.options
                  .credentialEncryptionKey
              ),
            githubAccessTokenExpiresAt:
              refreshed
                .accessTokenExpiresAt,
            githubRefreshTokenCiphertext:
              nextRefreshCiphertext,
            githubRefreshTokenExpiresAt:
              nextRefreshExpiresAt
          }
        );
    } catch {
      return user;
    }
  }

  async resolveSessionContext(
    rawToken: string,
    now = new Date()
  ): Promise<
    ResolvedAuthContext | null
  > {
    const active =
      await this.options.sessions
        .findActiveByTokenHash(
          hashSessionToken(rawToken),
          now
        );

    if (!active) {
      return null;
    }

    const user =
      await this.refreshUserCredential(
        active.user,
        now
      );

    if (
      this.options.sessions.touch &&
      now.getTime() -
        active.session.lastSeenAt
          .getTime() >=
        SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.options.sessions.touch(
        active.session.id,
        now
      );
    }

    return {
      sessionId:
        active.session.id,
      userId: user.id,
      principal: {
        provider: "GITHUB",
        providerUserId:
          user.providerUserId,
        login: user.login
      },
      githubAccessTokenCiphertext:
        user
          .githubAccessTokenCiphertext,
      githubAccessTokenExpiresAt:
        user
          .githubAccessTokenExpiresAt
    };
  }

  async resolveSession(
    rawToken: string,
    now = new Date()
  ): Promise<
    AuthenticatedPrincipal | null
  > {
    const context =
      await this.resolveSessionContext(
        rawToken,
        now
      );

    return context?.principal ?? null;
  }

  async signOut(
    rawToken: string,
    now = new Date()
  ): Promise<string> {
    await this.options.sessions
      .revokeByTokenHash(
        hashSessionToken(rawToken),
        now
      );

    return buildSessionDeletionCookie(
      this.options.secureCookies
    );
  }
}
EOF

python3 <<'PY'
from pathlib import Path
p = Path("apps/control-plane/tests/github-oauth-client.test.ts")
s = p.read_text()
if 'refreshes an expiring GitHub App user access token' not in s:
    insert = '''\n  it("refreshes an expiring GitHub App user access token", async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "ghu_new",
            expires_in: 3600,
            refresh_token: "ghr_new",
            refresh_token_expires_in: 7200
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const client = new GitHubOAuthClient({
      clientId: "client",
      clientSecret: "secret",
      callbackUrl: "http://localhost:3000/auth/github/callback",
      fetchFn
    });

    const token = await client.refreshAccessToken(
      "ghr_old",
      new Date("2026-09-02T00:00:00Z")
    );

    expect(token.accessToken).toBe("ghu_new");

    const request = fetchFn.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain(
      "grant_type=refresh_token"
    );
    expect(String(request?.body)).toContain(
      "refresh_token=ghr_old"
    );
  });\n'''
    idx = s.rfind('\n  }\n);')
    if idx < 0:
        raise SystemExit("Could not locate GitHub OAuth test suite end.")
    s = s[:idx] + insert + s[idx:]
p.write_text(s)
PY

cat > apps/control-plane/tests/auth-refresh.test.ts <<'EOF'
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  AuthSessionRow,
  AuthUserRow,
  UpdateGitHubUserCredentialsInput
} from "@contribos/db";

import {
  AuthService
} from "../src/security/auth-service.js";
import {
  decryptCredential,
  encryptCredential
} from "../src/security/credential-cipher.js";

const key = Buffer.alloc(32, 31)
  .toString("base64");

function userRow(): AuthUserRow {
  const now = new Date(
    "2026-09-02T00:00:00Z"
  );

  return {
    id: "00000000-0000-4000-8000-000000000001",
    provider: "GITHUB",
    providerUserId: "42",
    login: "octocat",
    avatarUrl: null,
    githubAccessTokenCiphertext:
      encryptCredential("ghu_old", key),
    githubAccessTokenExpiresAt:
      new Date(
        "2026-09-01T23:59:00Z"
      ),
    githubRefreshTokenCiphertext:
      encryptCredential("ghr_old", key),
    githubRefreshTokenExpiresAt:
      new Date(
        "2026-09-03T00:00:00Z"
      ),
    createdAt: now,
    updatedAt: now
  };
}

function sessionRow(): AuthSessionRow {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000001",
    tokenHash: "a".repeat(64),
    expiresAt:
      new Date(
        "2026-09-03T00:00:00Z"
      ),
    revokedAt: null,
    lastSeenAt:
      new Date(
        "2026-09-01T23:00:00Z"
      ),
    createdAt:
      new Date(
        "2026-09-01T23:00:00Z"
      ),
    updatedAt:
      new Date(
        "2026-09-01T23:00:00Z"
      )
  };
}

describe("AuthService refresh hardening", () => {
  it("refreshes expired GitHub credentials and throttles session last-seen writes", async () => {
    const oldUser = userRow();
    const touch = vi.fn(async () => {});
    const update = vi.fn(
      async (
        _id: string,
        input:
          UpdateGitHubUserCredentialsInput
      ): Promise<AuthUserRow> => ({
        ...oldUser,
        ...input,
        updatedAt:
          new Date(
            "2026-09-02T00:00:00Z"
          )
      })
    );

    const service = new AuthService({
      oauth: {
        refreshAccessToken:
          vi.fn(async () => ({
            accessToken: "ghu_new",
            accessTokenExpiresAt:
              new Date(
                "2026-09-02T01:00:00Z"
              ),
            refreshToken: "ghr_new",
            refreshTokenExpiresAt:
              new Date(
                "2026-09-03T01:00:00Z"
              )
          }))
      } as never,
      users: {
        upsertGitHubUser:
          vi.fn() as never,
        updateGitHubCredentials:
          update
      },
      sessions: {
        create: vi.fn() as never,
        findActiveByTokenHash:
          async () => ({
            session: sessionRow(),
            user: oldUser
          }),
        revokeByTokenHash:
          async () => true,
        touch
      },
      oauthStates: {} as never,
      credentialEncryptionKey: key,
      secureCookies: false,
      sessionTtlSeconds: 604800,
      oauthStateTtlSeconds: 600
    });

    const context =
      await service.resolveSessionContext(
        "A".repeat(43),
        new Date(
          "2026-09-02T00:00:00Z"
        )
      );

    expect(update).toHaveBeenCalledTimes(1);
    expect(touch).toHaveBeenCalledTimes(1);
    expect(
      decryptCredential(
        context!
          .githubAccessTokenCiphertext,
        key
      )
    ).toBe("ghu_new");
    expect(
      context?.githubAccessTokenExpiresAt
        ?.toISOString()
    ).toBe(
      "2026-09-02T01:00:00.000Z"
    );
  });

  it("fails closed to reauthentication material when refresh fails", async () => {
    const oldUser = userRow();

    const service = new AuthService({
      oauth: {
        refreshAccessToken:
          vi.fn(async () => {
            throw new Error("refresh failed");
          })
      } as never,
      users: {
        upsertGitHubUser:
          vi.fn() as never,
        updateGitHubCredentials:
          vi.fn() as never
      },
      sessions: {
        create: vi.fn() as never,
        findActiveByTokenHash:
          async () => ({
            session: sessionRow(),
            user: oldUser
          }),
        revokeByTokenHash:
          async () => true
      },
      oauthStates: {} as never,
      credentialEncryptionKey: key,
      secureCookies: false,
      sessionTtlSeconds: 604800,
      oauthStateTtlSeconds: 600
    });

    const context =
      await service.resolveSessionContext(
        "A".repeat(43),
        new Date(
          "2026-09-02T00:00:00Z"
        )
      );

    expect(
      context?.githubAccessTokenExpiresAt
        ?.toISOString()
    ).toBe(
      "2026-09-01T23:59:00.000Z"
    );
  });
});
EOF

echo
echo "== 11.7 Webhook signature ordering and payload minimization =="

cat > apps/control-plane/src/github-webhook-service.ts <<'EOF'
import {
  normalizeGitHubWebhookEvent,
  processWebhook,
  verifyGitHubWebhookSignature,
  type GitHubWebhookEnvelope,
  type NormalizedGitHubWebhookEvent,
  type WebhookDeliveryStore
} from "@contribos/github";

import type {
  WebhookApplicationService
} from "./webhook-application-service.js";

type UnknownRecord =
  Record<string, unknown>;

export interface WebhookDeliveryLifecycle
  extends WebhookDeliveryStore
{
  recordMetadata(input: {
    deliveryId: string;
    eventName: string;
    action?: string | null;
    githubInstallationId?: string | null;
    githubRepositoryId?: string | null;
    payload?: unknown;
    receivedAt?: Date | null;
  }): Promise<void>;

  markProcessed(
    deliveryId: string
  ): Promise<void>;

  markFailed(
    deliveryId: string,
    errorCode: string,
    retryable?: boolean
  ): Promise<void>;
}

export interface GitHubWebhookHttpInput {
  rawBody: string;
  deliveryId: string | undefined;
  eventName: string | undefined;
  signature: string | undefined;
  receivedAt?: Date;
}

export interface GitHubWebhookHttpResult {
  statusCode: number;
  body: {
    status: string;
    reasonCode: string;
    deliveryId?: string;
  };
}

function asRecord(
  value: unknown
): UnknownRecord | null {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : null;
}

function nestedId(
  payload: UnknownRecord | null,
  key: string
): number | null {
  const nested =
    asRecord(payload?.[key]);

  const id = nested?.["id"];

  return (
    typeof id === "number" &&
    Number.isSafeInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

function compactPayload(
  event: NormalizedGitHubWebhookEvent
): Record<string, unknown> {
  return {
    objectType: event.objectType,
    objectId: event.objectId,
    objectUrl: event.objectUrl,
    contributionNumber:
      event.contributionNumber,
    headSha: event.headSha,
    occurredAt:
      event.occurredAt.toISOString()
  };
}

export class GitHubWebhookService {
  constructor(
    private readonly secret: string,
    private readonly deliveries:
      WebhookDeliveryLifecycle,
    private readonly webhooks:
      WebhookApplicationService
  ) {}

  async handle(
    input: GitHubWebhookHttpInput
  ): Promise<GitHubWebhookHttpResult> {
    if (!input.deliveryId?.trim()) {
      return {
        statusCode: 400,
        body: {
          status: "REJECTED",
          reasonCode:
            "MISSING_DELIVERY_ID"
        }
      };
    }

    if (!input.eventName?.trim()) {
      return {
        statusCode: 400,
        body: {
          status: "REJECTED",
          reasonCode:
            "MISSING_EVENT_NAME",
          deliveryId:
            input.deliveryId
        }
      };
    }

    if (
      !verifyGitHubWebhookSignature(
        input.rawBody,
        input.signature,
        this.secret
      )
    ) {
      return {
        statusCode: 401,
        body: {
          status: "REJECTED",
          reasonCode:
            "INVALID_SIGNATURE",
          deliveryId:
            input.deliveryId
        }
      };
    }

    let payload: unknown;

    try {
      payload = JSON.parse(
        input.rawBody
      );
    } catch {
      return {
        statusCode: 400,
        body: {
          status: "REJECTED",
          reasonCode: "INVALID_JSON",
          deliveryId:
            input.deliveryId
        }
      };
    }

    const payloadRecord =
      asRecord(payload);

    const envelope:
      GitHubWebhookEnvelope = {
        deliveryId:
          input.deliveryId,
        eventName:
          input.eventName,
        installationId:
          nestedId(
            payloadRecord,
            "installation"
          ),
        repositoryId:
          nestedId(
            payloadRecord,
            "repository"
          ),
        receivedAt:
          input.receivedAt ??
          new Date(),
        payload
      };

    const result =
      await processWebhook(
        envelope,
        this.deliveries
      );

    if (result.status === "REJECTED") {
      return {
        statusCode: 400,
        body: {
          status: result.status,
          reasonCode:
            result.reasonCode,
          deliveryId:
            result.deliveryId
        }
      };
    }

    if (result.status === "DUPLICATE") {
      return {
        statusCode: 202,
        body: {
          status: result.status,
          reasonCode:
            result.reasonCode,
          deliveryId:
            result.deliveryId
        }
      };
    }

    const normalized =
      normalizeGitHubWebhookEvent(
        envelope
      );

    if (!normalized) {
      await this.deliveries
        .recordMetadata({
          deliveryId:
            envelope.deliveryId,
          eventName:
            envelope.eventName,
          githubInstallationId:
            envelope.installationId ===
              null
              ? null
              : String(
                  envelope.installationId
                ),
          githubRepositoryId:
            envelope.repositoryId ===
              null
              ? null
              : String(
                  envelope.repositoryId
                ),
          payload: null,
          receivedAt:
            envelope.receivedAt
        });

      await this.deliveries.markFailed(
        envelope.deliveryId,
        "NORMALIZATION_FAILED",
        false
      );

      return {
        statusCode: 422,
        body: {
          status: "FAILED",
          reasonCode:
            "NORMALIZATION_FAILED",
          deliveryId:
            envelope.deliveryId
        }
      };
    }

    await this.deliveries
      .recordMetadata({
        deliveryId:
          envelope.deliveryId,
        eventName:
          envelope.eventName,
        action: normalized.action,
        githubInstallationId:
          String(
            normalized.installationId
          ),
        githubRepositoryId:
          String(
            normalized.repositoryId
          ),
        payload:
          compactPayload(normalized),
        receivedAt:
          envelope.receivedAt
      });

    try {
      const enqueueResult =
        await this.webhooks
          .acceptNormalizedEvent(
            normalized
          );

      await this.deliveries
        .markProcessed(
          envelope.deliveryId
        );

      return {
        statusCode: 202,
        body: {
          status: enqueueResult,
          reasonCode:
            enqueueResult ===
              "ENQUEUED"
              ? "WORK_ENQUEUED"
              : enqueueResult ===
                  "DUPLICATE"
                ? "WORK_ALREADY_QUEUED"
                : "NO_WORK_REQUIRED",
          deliveryId:
            envelope.deliveryId
        }
      };
    } catch (error) {
      await this.deliveries.markFailed(
        envelope.deliveryId,
        "WEBHOOK_ENQUEUE_FAILED",
        true
      );

      throw error;
    }
  }
}
EOF

cat > apps/control-plane/tests/github-webhook-service.test.ts <<'EOF'
import {
  createHmac
} from "node:crypto";

import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  InMemoryJobStore
} from "@contribos/worker";

import {
  GitHubWebhookService,
  type WebhookDeliveryLifecycle
} from "../src/github-webhook-service.js";
import {
  WebhookApplicationService
} from "../src/webhook-application-service.js";

class MemoryDeliveryLifecycle
  implements WebhookDeliveryLifecycle
{
  readonly claimed = new Set<string>();
  readonly processed = new Set<string>();
  readonly metadata: unknown[] = [];
  readonly failures: Array<{
    deliveryId: string;
    errorCode: string;
    retryable: boolean;
  }> = [];

  async tryClaim(
    deliveryId: string
  ): Promise<boolean> {
    if (this.claimed.has(deliveryId)) {
      return false;
    }

    this.claimed.add(deliveryId);
    return true;
  }

  async hasProcessed(
    deliveryId: string
  ): Promise<boolean> {
    return this.processed.has(deliveryId);
  }

  async markProcessed(
    deliveryId: string
  ): Promise<void> {
    this.processed.add(deliveryId);
  }

  async markFailed(
    deliveryId: string,
    errorCode: string,
    retryable = false
  ): Promise<void> {
    this.failures.push({
      deliveryId,
      errorCode,
      retryable
    });
  }

  async recordMetadata(
    input: unknown
  ): Promise<void> {
    this.metadata.push(input);
  }
}

function signature(
  rawBody: string,
  secret: string
): string {
  return (
    "sha256=" +
    createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex")
  );
}

function pullRequestBody(
  extra: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    action: "synchronize",
    number: 42,
    installation: { id: 10 },
    repository: {
      id: 20,
      html_url:
        "https://github.com/example/repo"
    },
    pull_request: {
      id: 100,
      number: 42,
      html_url:
        "https://example.test/pr/42",
      head: { sha: "abc123" },
      updated_at:
        "2026-08-26T00:00:00Z"
    },
    ...extra
  });
}

describe("GitHubWebhookService", () => {
  it("verifies, claims, normalizes, queues, and marks processed", async () => {
    const secret = "test-secret";
    const rawBody = pullRequestBody();
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service =
      new GitHubWebhookService(
        secret,
        deliveries,
        new WebhookApplicationService(
          new InMemoryJobStore()
        )
      );

    const result = await service.handle({
      rawBody,
      deliveryId: "delivery-1",
      eventName: "pull_request",
      signature:
        signature(rawBody, secret),
      receivedAt:
        new Date(
          "2026-08-26T00:00:00Z"
        )
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.status).toBe(
      "ENQUEUED"
    );
    expect(
      deliveries.processed.has(
        "delivery-1"
      )
    ).toBe(true);
  });

  it("rejects an invalid signature before parsing or claiming", async () => {
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service =
      new GitHubWebhookService(
        "secret",
        deliveries,
        new WebhookApplicationService(
          new InMemoryJobStore()
        )
      );

    const result = await service.handle({
      rawBody: "{not-json",
      deliveryId: "delivery-2",
      eventName: "pull_request",
      signature: "sha256=invalid"
    });

    expect(result.statusCode).toBe(401);
    expect(result.body.reasonCode).toBe(
      "INVALID_SIGNATURE"
    );
    expect(deliveries.claimed.size).toBe(0);
  });

  it("does not persist raw GitHub webhook payloads", async () => {
    const secret = "test-secret";
    const rawBody = pullRequestBody({
      sender: {
        login: "private-user",
        email:
          "sensitive@example.test"
      },
      secret_sentinel:
        "must-not-be-persisted"
    });
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service =
      new GitHubWebhookService(
        secret,
        deliveries,
        new WebhookApplicationService(
          new InMemoryJobStore()
        )
      );

    await service.handle({
      rawBody,
      deliveryId: "delivery-minimized",
      eventName: "pull_request",
      signature:
        signature(rawBody, secret)
    });

    const stored = JSON.stringify(
      deliveries.metadata
    );

    expect(stored).not.toContain(
      "sensitive@example.test"
    );
    expect(stored).not.toContain(
      "must-not-be-persisted"
    );
    expect(stored).toContain(
      "PULL_REQUEST"
    );
    expect(stored).toContain(
      "abc123"
    );
  });

  it("marks enqueue failures retryable", async () => {
    const secret = "test-secret";
    const rawBody = pullRequestBody();
    const deliveries =
      new MemoryDeliveryLifecycle();

    const webhooks = {
      acceptNormalizedEvent:
        vi.fn(async () => {
          throw new Error("queue unavailable");
        })
    };

    const service =
      new GitHubWebhookService(
        secret,
        deliveries,
        webhooks as never
      );

    await expect(
      service.handle({
        rawBody,
        deliveryId:
          "delivery-retryable",
        eventName: "pull_request",
        signature:
          signature(rawBody, secret)
      })
    ).rejects.toThrow(
      "queue unavailable"
    );

    expect(deliveries.failures).toContainEqual({
      deliveryId:
        "delivery-retryable",
      errorCode:
        "WEBHOOK_ENQUEUE_FAILED",
      retryable: true
    });
  });
});
EOF

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

const here = dirname(
  fileURLToPath(import.meta.url)
);

describe("webhook security ordering", () => {
  it("verifies the signature before JSON parsing at the HTTP service boundary", async () => {
    const source = await readFile(
      join(
        here,
        "../src/github-webhook-service.ts"
      ),
      "utf8"
    );

    const verifyIndex = source.indexOf(
      "verifyGitHubWebhookSignature("
    );
    const parseIndex = source.indexOf(
      "JSON.parse("
    );

    expect(verifyIndex)
      .toBeGreaterThanOrEqual(0);
    expect(parseIndex)
      .toBeGreaterThanOrEqual(0);
    expect(verifyIndex)
      .toBeLessThan(parseIndex);
  });
});
EOF

echo
echo "== Wiring startup migration and graceful service lifecycle =="

python3 <<'PY'
from pathlib import Path
p = Path("apps/control-plane/src/service-entrypoint.ts")
s = p.read_text()
old_import = '''import {
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
  RepositoryAccessScopeRepository,
  WebhookDeliveryRepository
} from "@contribos/db";
'''
new_import = '''import {
  AuthSessionRepository,
  AuthUserRepository,
  OAuthStateRepository,
  RepositoryAccessScopeRepository,
  WebhookDeliveryRepository,
  runDatabaseMigrations
} from "@contribos/db";
'''
if old_import in s:
    s = s.replace(old_import, new_import)
elif 'runDatabaseMigrations' not in s:
    raise SystemExit("Could not locate service-entrypoint db import.")

old_shutdown = '''  handle.runtime
    .requestShutdown();
  scheduler.stop();

  await new Promise<void>(
'''
new_shutdown = '''  handle.runtime
    .requestShutdown();
  scheduler.stop();

  await new Promise<void>(
'''
# Anchor retained intentionally; wait is inserted after server close.
if old_shutdown not in s and 'await scheduler.stopAndWait();' not in s:
    raise SystemExit("Could not locate service shutdown block.")

old_after_close = '''  await handle.close();
}
'''
new_after_close = '''  await scheduler.stopAndWait();
  await handle.close();
}
'''
if '  await scheduler.stopAndWait();\n  await handle.close();' not in s:
    if old_after_close in s:
        s = s.replace(old_after_close, new_after_close, 1)
    else:
        raise SystemExit("Could not locate handle.close in shutdown.")

start_marker = '''server.listen(
  config.port,
  config.host,
  () => {
    handle.runtime
      .markReady();
    scheduler.start();

    logger.info(
      "service.started",
      {
        host:
          config.host,
        port:
          config.port
      }
    );

    void handle.runtime
      .loop.run()
      .catch((error) => {
        logger.error(
          "worker.loop.failed",
          {
            message:
              error instanceof Error
                ? error.message
                : "Unknown failure."
          }
        );

        void shutdown(
          "WORKER_LOOP_FAILURE"
        );
      });
  }
);
'''
start_new = '''async function start(): Promise<void> {
  await runDatabaseMigrations(
    handle.db
  );

  server.listen(
    config.port,
    config.host,
    () => {
      handle.runtime
        .markReady();
      scheduler.start();

      logger.info(
        "service.started",
        {
          host:
            config.host,
          port:
            config.port
        }
      );

      void handle.runtime
        .startWorker()
        .catch((error) => {
          logger.error(
            "worker.loop.failed",
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown failure."
            }
          );

          void shutdown(
            "WORKER_LOOP_FAILURE"
          );
        });
    }
  );
}

void start().catch(async (error) => {
  logger.error(
    "service.startup.failed",
    {
      message:
        error instanceof Error
          ? error.message
          : "Unknown failure."
    }
  );

  try {
    await handle.close();
  } finally {
    process.exitCode = 1;
  }
});
'''
if start_marker in s:
    s = s.replace(start_marker, start_new)
elif 'await runDatabaseMigrations(' not in s or '.startWorker()' not in s:
    raise SystemExit("Could not locate service.listen startup block.")

p.write_text(s)
PY

cat > apps/control-plane/tests/startup-migration-order.test.ts <<'EOF'
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

const here = dirname(
  fileURLToPath(import.meta.url)
);

describe("service startup ordering", () => {
  it("applies database migrations before accepting traffic", async () => {
    const source = await readFile(
      join(
        here,
        "../src/service-entrypoint.ts"
      ),
      "utf8"
    );

    const migrationIndex =
      source.indexOf(
        "await runDatabaseMigrations("
      );
    const listenIndex =
      source.indexOf(
        "server.listen("
      );

    expect(migrationIndex)
      .toBeGreaterThanOrEqual(0);
    expect(listenIndex)
      .toBeGreaterThanOrEqual(0);
    expect(migrationIndex)
      .toBeLessThan(listenIndex);
  });
});
EOF

echo
echo "== Generating Drizzle migration for webhook retry metadata =="
pnpm --filter @contribos/db exec drizzle-kit generate

echo

echo "== Hardening DB integration test execution =="

python3 - <<'PYDB'
import json
from pathlib import Path

p = Path("packages/db/package.json")
data = json.loads(p.read_text())

data["scripts"]["test"] = (
    "vitest run --fileParallelism=false --testTimeout=15000"
)

p.write_text(
    json.dumps(data, indent=2) + "\n"
)

print("DB test command hardened.")
PYDB

echo "== Targeted Phase 11.2-11.7 verification =="
pnpm --filter @contribos/db test
pnpm --filter @contribos/db typecheck
pnpm --filter @contribos/db build

pnpm --filter @contribos/worker test
pnpm --filter @contribos/worker typecheck
pnpm --filter @contribos/worker build

pnpm --filter @contribos/control-plane test
pnpm --filter @contribos/control-plane typecheck
pnpm --filter @contribos/control-plane build

echo
echo "== Full repository verification =="
pnpm verify

echo
echo "== Phase 11.2-11.7 resulting working tree =="
git status --short
git diff --stat

echo
echo "Phase 11.2-11.7 hardening completed successfully."
echo "Review the diff before committing."

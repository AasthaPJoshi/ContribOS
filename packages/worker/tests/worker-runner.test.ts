import { describe, expect, it } from "vitest";

import { InMemoryJobStore } from "../src/in-memory-job-store.js";
import { WorkerRunner } from "../src/worker-runner.js";

async function enqueueOne(
  store: InMemoryJobStore,
  maxAttempts = 3
) {
  await store.enqueue({
    id: "job-1",
    type: "RECONCILE_PULL_REQUEST",
    payload: {
      installationId: 1,
      repositoryId: 2,
      pullRequestNumber: 42
    },
    deduplicationKey: "reconcile-pr:1:2:42",
    maxAttempts,
    availableAt: new Date("2026-08-26T00:00:00Z"),
    createdAt: new Date("2026-08-26T00:00:00Z")
  });
}

describe("WorkerRunner", () => {
  it("marks successful jobs completed", async () => {
    const store = new InMemoryJobStore();
    await enqueueOne(store);

    const runner = new WorkerRunner(
      store,
      { async handle() {} },
      { now: () => new Date("2026-08-26T00:00:00Z") }
    );

    expect(await runner.runOnce()).toEqual({
      status: "COMPLETED",
      jobId: "job-1"
    });
  });

  it("reschedules retryable failures with backoff", async () => {
    const store = new InMemoryJobStore();
    await enqueueOne(store);

    const runner = new WorkerRunner(
      store,
      {
        async handle() {
          throw new Error("boom");
        }
      },
      { now: () => new Date("2026-08-26T00:00:00Z") }
    );

    expect(await runner.runOnce()).toEqual({
      status: "RESCHEDULED",
      jobId: "job-1",
      nextAttempt: 1,
      availableAt: new Date("2026-08-26T00:00:01Z"),
      errorCode: "WORKER_ERROR"
    });
  });

  it("moves exhausted jobs to dead", async () => {
    const store = new InMemoryJobStore();
    await enqueueOne(store, 1);

    const runner = new WorkerRunner(
      store,
      {
        async handle() {
          throw new Error("boom");
        }
      },
      { now: () => new Date("2026-08-26T00:00:00Z") }
    );

    expect(await runner.runOnce()).toEqual({
      status: "DEAD",
      jobId: "job-1",
      attempt: 1,
      errorCode: "WORKER_ERROR"
    });
  });
});

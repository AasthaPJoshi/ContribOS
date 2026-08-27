import {
  describe,
  expect,
  it
} from "vitest";

import {
  InMemoryJobStore
} from "../src/in-memory-job-store.js";

describe("InMemoryJobStore", () => {
  it("deduplicates queued jobs", async () => {
    const store =
      new InMemoryJobStore();

    const input = {
      id: "job-1",
      type:
        "RECONCILE_PULL_REQUEST" as const,
      payload: {
        installationId: 1,
        repositoryId: 2,
        pullRequestNumber: 42
      },
      deduplicationKey:
        "reconcile-pr:1:2:42",
      maxAttempts: 5,
      availableAt:
        new Date("2026-08-26T00:00:00Z"),
      createdAt:
        new Date("2026-08-26T00:00:00Z")
    };

    expect(
      await store.enqueue(input)
    ).toBe(true);

    expect(
      await store.enqueue({
        ...input,
        id: "job-2"
      })
    ).toBe(false);
  });

  it("claims only available queued jobs", async () => {
    const store =
      new InMemoryJobStore();

    await store.enqueue({
      id: "job-1",
      type:
        "RECONCILE_PULL_REQUEST",
      payload: {
        installationId: 1,
        repositoryId: 2,
        pullRequestNumber: 42
      },
      deduplicationKey:
        "reconcile-pr:1:2:42",
      maxAttempts: 5,
      availableAt:
        new Date("2026-08-26T01:00:00Z"),
      createdAt:
        new Date("2026-08-26T00:00:00Z")
    });

    expect(
      await store.claimNext(
        new Date("2026-08-26T00:30:00Z")
      )
    ).toBeNull();

    expect(
      await store.claimNext(
        new Date("2026-08-26T01:00:00Z")
      )
    ).toMatchObject({
      id: "job-1"
    });
  });
});

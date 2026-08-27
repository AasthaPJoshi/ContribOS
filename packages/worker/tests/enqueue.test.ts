import {
  describe,
  expect,
  it
} from "vitest";

import {
  enqueueReconcilePullRequest
} from "../src/enqueue.js";
import {
  InMemoryJobStore
} from "../src/in-memory-job-store.js";

describe("enqueueReconcilePullRequest", () => {
  it("uses stable PR deduplication", async () => {
    const store =
      new InMemoryJobStore();

    const payload = {
      installationId: 1,
      repositoryId: 2,
      pullRequestNumber: 42
    };

    expect(
      await enqueueReconcilePullRequest(
        store,
        payload,
        {
          now: new Date(
            "2026-08-26T00:00:00Z"
          )
        }
      )
    ).toBe(true);

    expect(
      await enqueueReconcilePullRequest(
        store,
        payload,
        {
          now: new Date(
            "2026-08-26T00:00:01Z"
          )
        }
      )
    ).toBe(false);
  });
});

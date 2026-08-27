import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildMaintainerAttentionQueue,
  type AttentionCandidate
} from "../src/maintainer-attention-queue.js";

function candidate(
  overrides: Partial<AttentionCandidate> = {}
): AttentionCandidate {
  return {
    contributionId: "contribution-1",
    repositoryId: "repository-1",
    repositoryFullName: "open-source/contribos",
    pullRequestNumber: 1,
    url: "https://example.test/pr/1",
    updatedAt: new Date("2026-08-27T00:00:00Z"),
    lastReconciledAt: null,
    workflowState: "OPEN",
    nextActor: "AUTHOR",
    readiness: "NOT_READY",
    reasonCode: "AUTHOR_ACTION_REQUIRED",
    ...overrides
  };
}

describe("maintainer attention queue", () => {
  it("ranks ambiguous maintainer work ahead of ordinary work", () => {
    const result = buildMaintainerAttentionQueue([
      candidate({
        contributionId: "ordinary",
        pullRequestNumber: 10
      }),
      candidate({
        contributionId: "ambiguous",
        pullRequestNumber: 20,
        workflowState: "AMBIGUOUS",
        nextActor: "MAINTAINER",
        readiness: "AMBIGUOUS"
      })
    ]);

    expect(result.items[0]?.contributionId).toBe("ambiguous");
    expect(result.items[0]?.priorityBand).toBe("CRITICAL");
  });

  it("prioritizes ready-to-merge maintainer work", () => {
    const result = buildMaintainerAttentionQueue([
      candidate({
        contributionId: "review",
        readiness: "READY_FOR_REVIEW",
        nextActor: "MAINTAINER"
      }),
      candidate({
        contributionId: "merge",
        readiness: "READY_TO_MERGE",
        nextActor: "MAINTAINER"
      })
    ]);

    expect(result.items[0]?.contributionId).toBe("merge");
  });

  it("excludes terminal contributions", () => {
    const result = buildMaintainerAttentionQueue([
      candidate({
        workflowState: "MERGED"
      }),
      candidate({
        contributionId: "active",
        workflowState: "IN_REVIEW",
        nextActor: "MAINTAINER"
      })
    ]);

    expect(result.total).toBe(1);
    expect(result.items[0]?.contributionId).toBe("active");
  });

  it("applies deterministic filters", () => {
    const result = buildMaintainerAttentionQueue(
      [
        candidate({
          contributionId: "maintainer",
          nextActor: "MAINTAINER"
        }),
        candidate({
          contributionId: "author",
          nextActor: "AUTHOR"
        })
      ],
      {
        filters: {
          nextActor: "MAINTAINER"
        }
      }
    );

    expect(result.total).toBe(1);
    expect(result.items[0]?.contributionId).toBe("maintainer");
  });

  it("paginates after ranking", () => {
    const result = buildMaintainerAttentionQueue(
      [
        candidate({
          contributionId: "one",
          pullRequestNumber: 1
        }),
        candidate({
          contributionId: "two",
          pullRequestNumber: 2
        }),
        candidate({
          contributionId: "three",
          pullRequestNumber: 3
        })
      ],
      {
        page: 2,
        pageSize: 2
      }
    );

    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it("rejects invalid pagination", () => {
    expect(() =>
      buildMaintainerAttentionQueue([], {
        page: 0
      })
    ).toThrow();

    expect(() =>
      buildMaintainerAttentionQueue([], {
        pageSize: 101
      })
    ).toThrow();
  });
});

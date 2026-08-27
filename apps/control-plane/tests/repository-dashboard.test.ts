import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildRepositoryDashboard
} from "../src/repository-dashboard.js";

describe("repository dashboard", () => {
  it("aggregates product-facing repository state", () => {
    const dashboard =
      buildRepositoryDashboard({
        repository: {
          id: "repository-1",
          githubRepositoryId:
            "100",
          owner: "open-source",
          name: "contribos",
          fullName:
            "open-source/contribos",
          defaultBranch: "main",
          isPrivate: false
        },
        contributionCount: 4,
        contributions: [
          {
            id: "c1",
            pullRequestNumber: 11,
            url:
              "https://example.test/pr/11",
            headSha: "sha11",
            lastReconciledAt:
              new Date(
                "2026-08-27T00:05:00Z"
              ),
            workflowState:
              "READY_TO_MERGE",
            nextActor:
              "MAINTAINER",
            readiness:
              "READY_TO_MERGE",
            reasonCode:
              "READY_TO_MERGE"
          },
          {
            id: "c2",
            pullRequestNumber: 12,
            url:
              "https://example.test/pr/12",
            headSha: "sha12",
            lastReconciledAt:
              new Date(
                "2026-08-27T00:01:00Z"
              ),
            workflowState:
              "CHANGES_REQUESTED",
            nextActor: "AUTHOR",
            readiness:
              "NOT_READY",
            reasonCode:
              "CHANGES_REQUESTED"
          },
          {
            id: "c3",
            pullRequestNumber: 13,
            url:
              "https://example.test/pr/13",
            headSha: "sha13",
            lastReconciledAt: null,
            workflowState:
              "AMBIGUOUS",
            nextActor: "UNKNOWN",
            readiness:
              "AMBIGUOUS",
            reasonCode:
              "UNKNOWN_REVIEW_STATE"
          },
          {
            id: "c4",
            pullRequestNumber: 14,
            url:
              "https://example.test/pr/14",
            headSha: "sha14",
            lastReconciledAt:
              new Date(
                "2026-08-27T00:10:00Z"
              ),
            workflowState:
              "MERGED",
            nextActor: "NONE",
            readiness:
              "READY_FOR_RELEASE",
            reasonCode:
              "MERGED"
          }
        ]
      });

    expect(
      dashboard.totals.contributions
    ).toBe(4);
    expect(
      dashboard.totals.active
    ).toBe(3);
    expect(
      dashboard.totals.terminal
    ).toBe(1);
    expect(
      dashboard.totals.ambiguous
    ).toBe(1);
    expect(
      dashboard.totals.blocked
    ).toBe(2);
    expect(
      dashboard.totals.readyToMerge
    ).toBe(1);
    expect(
      dashboard.totals.readyForRelease
    ).toBe(1);
    expect(
      dashboard.totals.maintainerAction
    ).toBe(1);
    expect(
      dashboard.highestPullRequestNumber
    ).toBe(14);
    expect(
      dashboard.oldestUnreconciledAt
        ?.toISOString()
    ).toBe(
      "2026-08-27T00:01:00.000Z"
    );
  });

  it("handles an empty repository", () => {
    const dashboard =
      buildRepositoryDashboard({
        repository: {
          id: "repository-1",
          githubRepositoryId:
            "100",
          owner: "open-source",
          name: "contribos",
          fullName:
            "open-source/contribos",
          defaultBranch: "main",
          isPrivate: false
        },
        contributionCount: 0,
        contributions: []
      });

    expect(
      dashboard.totals.contributions
    ).toBe(0);
    expect(
      dashboard.highestPullRequestNumber
    ).toBeNull();
    expect(
      dashboard.oldestUnreconciledAt
    ).toBeNull();
  });
});

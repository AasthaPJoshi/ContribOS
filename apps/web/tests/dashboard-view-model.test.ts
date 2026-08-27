import {
  describe,
  expect,
  it
} from "vitest";

import {
  countEntries,
  dashboardMetrics,
  humanizeToken,
  recentContributions
} from "../src/product/dashboard-view-model.js";

describe(
  "repository dashboard view model",
  () => {
    it("humanizes deterministic state tokens", () => {
      expect(
        humanizeToken(
          "READY_TO_MERGE"
        )
      ).toBe("Ready To Merge");
    });

    it("builds the maintainer-facing metric set", () => {
      const metrics =
        dashboardMetrics({
          repository: {
            id: "repo-1",
            githubRepositoryId:
              "100",
            owner: "open-source",
            name: "contribos",
            fullName:
              "open-source/contribos",
            defaultBranch: "main",
            isPrivate: false
          },
          totals: {
            contributions: 12,
            active: 8,
            terminal: 4,
            ambiguous: 1,
            blocked: 2,
            readyForReview: 2,
            readyForRereview: 1,
            readyToMerge: 3,
            readyForRelease: 1,
            maintainerAction: 4,
            authorAction: 2,
            ciAction: 1,
            unknownAction: 1
          },
          byWorkflowState: {},
          byReadiness: {},
          byNextActor: {},
          highestPullRequestNumber:
            42,
          oldestUnreconciledAt: null
        });

      expect(
        metrics.map(
          ({ label, value }) => [
            label,
            value
          ]
        )
      ).toEqual([
        ["Active", 8],
        ["Needs maintainer", 4],
        ["Ready to merge", 3],
        ["Blocked", 2],
        ["Ambiguous", 1],
        ["Ready for release", 1]
      ]);
    });

    it("sorts count entries by volume then label", () => {
      expect(
        countEntries({
          AUTHOR: 2,
          MAINTAINER: 5,
          CI: 2,
          NONE: 0
        })
      ).toEqual([
        {
          label: "Maintainer",
          value: 5
        },
        {
          label: "Author",
          value: 2
        },
        {
          label: "Ci",
          value: 2
        }
      ]);
    });

    it("returns the highest numbered contributions first", () => {
      const contributions = [
        {
          id: "c1",
          pullRequestNumber: 7,
          url: "https://example/7",
          headSha: "a",
          lastReconciledAt: null,
          workflowState: "OPEN",
          nextActor: "MAINTAINER",
          readiness:
            "READY_FOR_REVIEW",
          reasonCode:
            "READY_FOR_REVIEW"
        },
        {
          id: "c2",
          pullRequestNumber: 11,
          url: "https://example/11",
          headSha: "b",
          lastReconciledAt: null,
          workflowState:
            "READY_TO_MERGE",
          nextActor: "MAINTAINER",
          readiness:
            "READY_TO_MERGE",
          reasonCode:
            "READY_TO_MERGE"
        }
      ] as const;

      expect(
        recentContributions(
          [...contributions],
          1
        )[0]?.pullRequestNumber
      ).toBe(11);
    });
  }
);

import { describe, expect, it } from "vitest";
import type {
  ContributionDetail,
  RepositoryOverview
} from "../src/product-query-service.js";

describe("product query contracts", () => {
  it("represents current deterministic contribution state", () => {
    const detail: ContributionDetail = {
      repository: {
        id: "repository-1",
        githubRepositoryId: "100",
        owner: "open-source",
        name: "contribos",
        fullName: "open-source/contribos",
        defaultBranch: "main",
        isPrivate: false
      },
      contribution: {
        id: "contribution-1",
        githubPullRequestId: "200",
        pullRequestNumber: 42,
        url: "https://example.test/pr/42",
        headSha: "abc123",
        lastReconciledAt: new Date("2026-08-27T00:00:00Z")
      },
      currentState: {
        workflowState: "READY_TO_MERGE",
        nextActor: "MAINTAINER",
        readiness: "READY_TO_MERGE",
        reasonCode: "READY_TO_MERGE",
        explanation: "Ready to merge.",
        engineVersion: "0.1.0",
        evaluatedAt: new Date("2026-08-27T00:00:00Z")
      }
    };

    expect(detail.currentState?.nextActor).toBe("MAINTAINER");
    expect(detail.currentState?.readiness).toBe("READY_TO_MERGE");
  });

  it("supports repository-level contribution summaries", () => {
    const overview: RepositoryOverview = {
      repository: {
        id: "repository-1",
        githubRepositoryId: "100",
        owner: "open-source",
        name: "contribos",
        fullName: "open-source/contribos",
        defaultBranch: "main",
        isPrivate: false
      },
      contributionCount: 1,
      contributions: [
        {
          id: "contribution-1",
          pullRequestNumber: 42,
          url: "https://example.test/pr/42",
          headSha: "abc123",
          lastReconciledAt: null,
          workflowState: "IN_REVIEW",
          nextActor: "MAINTAINER",
          readiness: "READY_FOR_REVIEW",
          reasonCode: "MAINTAINER_REVIEW_REQUIRED"
        }
      ]
    };

    expect(overview.contributionCount).toBe(1);
    expect(overview.contributions[0]?.pullRequestNumber).toBe(42);
  });
});

import { describe, expect, it } from "vitest";

import {
  createPullRequestEvidence,
  type GitHubPullRequestRecord
} from "../src/index.js";

describe("createPullRequestEvidence", () => {
  it("creates a traceable evidence reference for a pull request", () => {
    const record: GitHubPullRequestRecord = {
      repositoryId: "repo_123",
      pullRequestNumber: 42,
      pullRequestId: "pr_456",
      url: "https://github.com/example/repo/pull/42",
      headSha: "abc123",

      isDraft: false,
      isOpen: true,
      isMerged: false,
      hasMergeConflict: false,

      checkStatus: "SUCCESS",
      reviewDecision: "APPROVED",

      authorHasChangesToMake: false,
      maintainerReviewRequired: false
    };

    const occurredAt = new Date("2026-08-25T00:00:00.000Z");

    const evidence = createPullRequestEvidence(record, occurredAt);

    expect(evidence).toEqual({
      id: "github:pull-request:pr_456",
      source: "GITHUB",
      objectType: "PULL_REQUEST",
      externalId: "pr_456",
      url: "https://github.com/example/repo/pull/42",
      occurredAt
    });
  });
});

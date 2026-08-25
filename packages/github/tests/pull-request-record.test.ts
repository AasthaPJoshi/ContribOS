import { describe, expect, it } from "vitest";

import {
  toPullRequestSnapshot,
  type GitHubPullRequestRecord
} from "../src/pull-request-record.js";

describe("toPullRequestSnapshot", () => {
  it("normalizes a GitHub pull request record into a domain snapshot", () => {
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

    const snapshot = toPullRequestSnapshot(record);

    expect(snapshot.evidence).toHaveLength(1);
    expect(snapshot.evidence[0]).toMatchObject({
      id: "github:pull-request:pr_456",
      source: "GITHUB",
      objectType: "PULL_REQUEST",
      externalId: "pr_456",
      url: "https://github.com/example/repo/pull/42"
    });

    expect(snapshot).toMatchObject({
      isDraft: false,
      isOpen: true,
      isMerged: false,
      hasMergeConflict: false,
      checkStatus: "SUCCESS",
      reviewDecision: "APPROVED",
      authorHasChangesToMake: false,
      maintainerReviewRequired: false
    });
  });
});

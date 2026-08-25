import { describe, expect, it } from "vitest";
import { evaluatePullRequest } from "../src/evaluate-pull-request.js";

describe("evaluatePullRequest", () => {
  it("marks a merged pull request as ready for release", () => {
    const result = evaluatePullRequest({
    evidence: [],
      isDraft: false,
      isOpen: false,
      isMerged: true,
      hasMergeConflict: false,
      checkStatus: "SUCCESS",
      reviewDecision: "APPROVED",
      authorHasChangesToMake: false,
      maintainerReviewRequired: false
    });

    expect(result.workflowState).toBe("MERGED");
    expect(result.nextActor).toBe("NONE");
    expect(result.readiness).toBe("READY_FOR_RELEASE");
    expect(result.reasonCode).toBe("PR_MERGED");
  });
});

it("assigns the next action to the author when CI fails", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "FAILURE",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("OPEN");
  expect(result.nextActor).toBe("AUTHOR");
  expect(result.readiness).toBe("NOT_READY");
  expect(result.reasonCode).toBe("CI_FAILED");
});

it("assigns the next action to the author when changes are requested", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "CHANGES_REQUESTED",
    authorHasChangesToMake: true,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("CHANGES_REQUESTED");
  expect(result.nextActor).toBe("AUTHOR");
  expect(result.readiness).toBe("NOT_READY");
  expect(result.reasonCode).toBe("CHANGES_REQUESTED");
});

it("assigns the next action to the maintainer when the PR is ready for review", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("IN_REVIEW");
  expect(result.nextActor).toBe("MAINTAINER");
  expect(result.readiness).toBe("READY_FOR_REVIEW");
  expect(result.reasonCode).toBe("MAINTAINER_REVIEW_REQUIRED");
});

it("marks an approved green PR as ready to merge", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "APPROVED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("READY_TO_MERGE");
  expect(result.nextActor).toBe("MAINTAINER");
  expect(result.readiness).toBe("READY_TO_MERGE");
  expect(result.reasonCode).toBe("READY_TO_MERGE");
});

it("assigns the next action to the author when the PR has a merge conflict", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: true,
    checkStatus: "SUCCESS",
    reviewDecision: "APPROVED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("OPEN");
  expect(result.nextActor).toBe("AUTHOR");
  expect(result.readiness).toBe("NOT_READY");
  expect(result.reasonCode).toBe("MERGE_CONFLICT");
});

it("waits on CI when required checks are still pending", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "PENDING",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("OPEN");
  expect(result.nextActor).toBe("CI");
  expect(result.readiness).toBe("NOT_READY");
  expect(result.reasonCode).toBe("CI_PENDING");
});

it("assigns the next action to the author when the PR is still a draft", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: true,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("DRAFT");
  expect(result.nextActor).toBe("AUTHOR");
  expect(result.readiness).toBe("NOT_READY");
  expect(result.reasonCode).toBe("PR_DRAFT");
});

it("marks a closed unmerged PR as complete with no next actor", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: false,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("CLOSED");
  expect(result.nextActor).toBe("NONE");
  expect(result.readiness).toBe("COMPLETE");
  expect(result.reasonCode).toBe("PR_CLOSED");
});

it("returns ambiguous when CI status is unknown", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "UNKNOWN",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("AMBIGUOUS");
  expect(result.nextActor).toBe("UNKNOWN");
  expect(result.readiness).toBe("AMBIGUOUS");
  expect(result.reasonCode).toBe("CI_STATUS_UNKNOWN");
});

it("returns ambiguous when review status is unknown", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "UNKNOWN",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("AMBIGUOUS");
  expect(result.nextActor).toBe("UNKNOWN");
  expect(result.readiness).toBe("AMBIGUOUS");
  expect(result.reasonCode).toBe("REVIEW_STATUS_UNKNOWN");
});

it("does not classify an approved PR as still requiring review", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "APPROVED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.reasonCode).not.toBe("MAINTAINER_REVIEW_REQUIRED");
});

it("does not mark an approved green PR as ready to merge when it has a merge conflict", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: true,
    checkStatus: "SUCCESS",
    reviewDecision: "APPROVED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("OPEN");
  expect(result.nextActor).toBe("AUTHOR");
  expect(result.readiness).toBe("NOT_READY");
  expect(result.reasonCode).toBe("MERGE_CONFLICT");
});

it("marks a green PR with required review as ready for maintainer review", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("IN_REVIEW");
  expect(result.nextActor).toBe("MAINTAINER");
  expect(result.readiness).toBe("READY_FOR_REVIEW");
  expect(result.reasonCode).toBe("MAINTAINER_REVIEW_REQUIRED");
});

it("returns ambiguous when an approved PR is still marked as requiring maintainer review", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "APPROVED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: true
  });

  expect(result.workflowState).toBe("AMBIGUOUS");
  expect(result.nextActor).toBe("UNKNOWN");
  expect(result.readiness).toBe("AMBIGUOUS");
  expect(result.reasonCode).toBe("INCONSISTENT_REVIEW_STATE");
});

it("returns ambiguous when changes are requested but no author changes are recorded", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "CHANGES_REQUESTED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("AMBIGUOUS");
  expect(result.nextActor).toBe("UNKNOWN");
  expect(result.readiness).toBe("AMBIGUOUS");
  expect(result.reasonCode).toBe("INCONSISTENT_CHANGE_REQUEST_STATE");
});

it("falls back to ambiguous when no deterministic rule matches", () => {
  const result = evaluatePullRequest({
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "REVIEW_REQUIRED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false
  });

  expect(result.workflowState).toBe("AMBIGUOUS");
  expect(result.nextActor).toBe("UNKNOWN");
  expect(result.readiness).toBe("AMBIGUOUS");
  expect(result.reasonCode).toBe("NO_MATCHING_RULE");
});

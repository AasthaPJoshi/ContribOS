import type {
  PullRequestSnapshot,
  StateEvaluation
} from "@contribos/domain";

export function evaluatePullRequest(
  snapshot: PullRequestSnapshot
): StateEvaluation {
  const ciSatisfied =
    snapshot.checkStatus === "SUCCESS" ||
    snapshot.checkStatus === "NOT_REQUIRED";
  if (snapshot.isMerged) {
    return {
      workflowState: "MERGED",
      nextActor: "NONE",
      readiness: "READY_FOR_RELEASE",
      reasonCode: "PR_MERGED",
      explanation: "The pull request has been merged.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (!snapshot.isOpen && !snapshot.isMerged) {
    return {
      workflowState: "CLOSED",
      nextActor: "NONE",
      readiness: "COMPLETE",
      reasonCode: "PR_CLOSED",
      explanation: "The pull request was closed without being merged.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (snapshot.isDraft) {
    return {
      workflowState: "DRAFT",
      nextActor: "AUTHOR",
      readiness: "NOT_READY",
      reasonCode: "PR_DRAFT",
      explanation: "The pull request is still marked as a draft.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (snapshot.checkStatus === "FAILURE") {
    return {
      workflowState: "OPEN",
      nextActor: "AUTHOR",
      readiness: "NOT_READY",
      reasonCode: "CI_FAILED",
      explanation: "Required checks are failing on the current pull request state.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (snapshot.checkStatus === "PENDING") {
    return {
      workflowState: "OPEN",
      nextActor: "CI",
      readiness: "NOT_READY",
      reasonCode: "CI_PENDING",
      explanation: "Required checks are still running.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (snapshot.checkStatus === "UNKNOWN") {
    return {
      workflowState: "AMBIGUOUS",
      nextActor: "UNKNOWN",
      readiness: "AMBIGUOUS",
      reasonCode: "CI_STATUS_UNKNOWN",
      explanation: "Required check status is unavailable, so the next action cannot be determined safely.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (snapshot.reviewDecision === "UNKNOWN") {
    return {
      workflowState: "AMBIGUOUS",
      nextActor: "UNKNOWN",
      readiness: "AMBIGUOUS",
      reasonCode: "REVIEW_STATUS_UNKNOWN",
      explanation: "Review status is unavailable, so the next action cannot be determined safely.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (
    snapshot.reviewDecision === "CHANGES_REQUESTED" &&
    snapshot.authorHasChangesToMake
  ) {
    return {
      workflowState: "CHANGES_REQUESTED",
      nextActor: "AUTHOR",
      readiness: "NOT_READY",
      reasonCode: "CHANGES_REQUESTED",
      explanation: "Reviewer-requested changes are still outstanding.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (
    snapshot.reviewDecision === "CHANGES_REQUESTED" &&
    !snapshot.authorHasChangesToMake
  ) {
    return {
      workflowState: "AMBIGUOUS",
      nextActor: "UNKNOWN",
      readiness: "AMBIGUOUS",
      reasonCode: "INCONSISTENT_CHANGE_REQUEST_STATE",
      explanation: "Changes were requested, but no outstanding author changes are recorded.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (snapshot.hasMergeConflict) {
    return {
      workflowState: "OPEN",
      nextActor: "AUTHOR",
      readiness: "NOT_READY",
      reasonCode: "MERGE_CONFLICT",
      explanation: "The pull request has a merge conflict that must be resolved.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (
    snapshot.reviewDecision === "REVIEW_REQUIRED" &&
    ciSatisfied &&
    !snapshot.authorHasChangesToMake &&
    snapshot.maintainerReviewRequired
  ) {
    return {
      workflowState: "IN_REVIEW",
      nextActor: "MAINTAINER",
      readiness: "READY_FOR_REVIEW",
      reasonCode: "MAINTAINER_REVIEW_REQUIRED",
      explanation: "The pull request is ready and requires maintainer review.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (
    snapshot.reviewDecision === "APPROVED" &&
    snapshot.maintainerReviewRequired
  ) {
    return {
      workflowState: "AMBIGUOUS",
      nextActor: "UNKNOWN",
      readiness: "AMBIGUOUS",
      reasonCode: "INCONSISTENT_REVIEW_STATE",
      explanation: "The pull request is approved but still marked as requiring maintainer review.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  if (
    snapshot.reviewDecision === "APPROVED" &&
    ciSatisfied &&
    !snapshot.hasMergeConflict &&
    !snapshot.authorHasChangesToMake &&
    !snapshot.maintainerReviewRequired
  ) {
    return {
      workflowState: "READY_TO_MERGE",
      nextActor: "MAINTAINER",
      readiness: "READY_TO_MERGE",
      reasonCode: "READY_TO_MERGE",
      explanation: "The pull request is approved, checks are successful, and it is ready to merge.",
      evidence: snapshot.evidence,
      evaluatedAt: new Date(),
      engineVersion: "0.1.0"
    };
  }

  return {
    workflowState: "AMBIGUOUS",
    nextActor: "UNKNOWN",
    readiness: "AMBIGUOUS",
    reasonCode: "NO_MATCHING_RULE",
    explanation: "No deterministic rule matched the current pull request snapshot.",
    evidence: snapshot.evidence,
    evaluatedAt: new Date(),
    engineVersion: "0.1.0"
  };
}

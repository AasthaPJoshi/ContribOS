export type CheckStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILURE"
  | "UNKNOWN";

export type ReviewDecision =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REVIEW_REQUIRED"
  | "UNKNOWN";

export interface PullRequestSnapshot {
  isDraft: boolean;
  isOpen: boolean;
  isMerged: boolean;
  hasMergeConflict: boolean;

  checkStatus: CheckStatus;
  reviewDecision: ReviewDecision;

  authorHasChangesToMake: boolean;
  maintainerReviewRequired: boolean;
}

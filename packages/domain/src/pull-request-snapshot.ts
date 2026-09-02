export type CheckStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILURE"
  | "NOT_REQUIRED"
  | "UNKNOWN";

export type ReviewDecision =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REVIEW_REQUIRED"
  | "UNKNOWN";

import type { EvidenceRef } from "./evidence.js";

export interface PullRequestSnapshot {
  evidence: EvidenceRef[];

  isDraft: boolean;
  isOpen: boolean;
  isMerged: boolean;
  hasMergeConflict: boolean;

  checkStatus: CheckStatus;
  reviewDecision: ReviewDecision;

  authorHasChangesToMake: boolean;
  maintainerReviewRequired: boolean;
}

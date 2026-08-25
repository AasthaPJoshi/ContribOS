import type {
  CheckStatus,
  PullRequestSnapshot,
  ReviewDecision
} from "@contribos/domain";

export interface GitHubPullRequestRecord {
  repositoryId: string;
  pullRequestNumber: number;
  pullRequestId: string;
  url: string;
  headSha: string;

  isDraft: boolean;
  isOpen: boolean;
  isMerged: boolean;
  hasMergeConflict: boolean;

  checkStatus: CheckStatus;
  reviewDecision: ReviewDecision;

  authorHasChangesToMake: boolean;
  maintainerReviewRequired: boolean;
}

export function toPullRequestSnapshot(
  record: GitHubPullRequestRecord
): PullRequestSnapshot {
  return {
    isDraft: record.isDraft,
    isOpen: record.isOpen,
    isMerged: record.isMerged,
    hasMergeConflict: record.hasMergeConflict,
    checkStatus: record.checkStatus,
    reviewDecision: record.reviewDecision,
    authorHasChangesToMake: record.authorHasChangesToMake,
    maintainerReviewRequired: record.maintainerReviewRequired
  };
}

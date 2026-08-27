export type WorkflowState =
  | "DRAFT"
  | "OPEN"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "READY_TO_MERGE"
  | "MERGED"
  | "RELEASED"
  | "CLOSED"
  | "AMBIGUOUS";

export type NextActor =
  | "AUTHOR"
  | "REVIEWER"
  | "MAINTAINER"
  | "CI"
  | "RELEASE_MANAGER"
  | "SYSTEM"
  | "NONE"
  | "UNKNOWN";

export type Readiness =
  | "NOT_READY"
  | "READY_FOR_REVIEW"
  | "READY_FOR_REREVIEW"
  | "READY_TO_MERGE"
  | "READY_FOR_RELEASE"
  | "COMPLETE"
  | "AMBIGUOUS";

export interface RepositoryIdentity {
  id: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface RepositoryContributionSummary {
  id: string;
  pullRequestNumber: number;
  url: string;
  headSha: string | null;
  lastReconciledAt: string | null;
  workflowState: WorkflowState | null;
  nextActor: NextActor | null;
  readiness: Readiness | null;
  reasonCode: string | null;
}

export interface RepositoryOverview {
  repository: RepositoryIdentity;
  contributionCount: number;
  contributions: RepositoryContributionSummary[];
}

export interface RepositoryDashboard {
  repository: RepositoryIdentity;
  totals: {
    contributions: number;
    active: number;
    terminal: number;
    ambiguous: number;
    blocked: number;
    readyForReview: number;
    readyForRereview: number;
    readyToMerge: number;
    readyForRelease: number;
    maintainerAction: number;
    authorAction: number;
    ciAction: number;
    unknownAction: number;
  };
  byWorkflowState: Record<string, number>;
  byReadiness: Record<string, number>;
  byNextActor: Record<string, number>;
  highestPullRequestNumber: number | null;
  oldestUnreconciledAt: string | null;
}

export interface AttentionQueueItem
  extends RepositoryContributionSummary {
  repositoryId: string;
  repositoryFullName: string;
  updatedAt: string;
  priorityScore: number;
  priorityBand:
    | "CRITICAL"
    | "HIGH"
    | "NORMAL"
    | "LOW";
  priorityReasons: string[];
}

export interface AttentionQueuePage {
  items: AttentionQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContributionDetail {
  repository: RepositoryIdentity;
  contribution: RepositoryContributionSummary;
  currentState: {
    workflowState: WorkflowState;
    nextActor: NextActor;
    readiness: Readiness;
    reasonCode: string;
    explanation: string;
    evaluatedAt: string;
  } | null;
}

export interface ContributionDecisionTrail {
  stateHistory: Array<{
    id: string;
    evaluationId: string;
    fromState: string | null;
    toState: string;
    reasonCode: string;
    changedAt: string;
  }>;
  evidence: Array<{
    id: string;
    evidenceId: string;
    source: string;
    objectType: string;
    externalId: string;
    url: string | null;
    occurredAt: string | null;
    capturedAt: string;
  }>;
  reconciliationRuns: Array<{
    id: string;
    status: string;
    reasonCode: string | null;
    headSha: string | null;
    repairAction: string | null;
    driftFields: string[];
    startedAt: string;
    completedAt: string | null;
  }>;
}

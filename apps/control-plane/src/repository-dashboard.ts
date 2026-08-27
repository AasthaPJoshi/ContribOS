import type {
  RepositoryContributionSummary,
  RepositoryOverview
} from "./product-query-service.js";

export interface RepositoryDashboard {
  repository: RepositoryOverview["repository"];
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
  oldestUnreconciledAt: Date | null;
}

const TERMINAL_STATES = new Set([
  "MERGED",
  "RELEASED",
  "CLOSED"
]);

const BLOCKED_STATES = new Set([
  "CHANGES_REQUESTED",
  "AMBIGUOUS"
]);

function increment(
  target: Record<string, number>,
  key: string | null
): void {
  const normalized = key ?? "UNKNOWN";
  target[normalized] =
    (target[normalized] ?? 0) + 1;
}

function isBlocked(
  contribution:
    RepositoryContributionSummary
): boolean {
  if (
    contribution.workflowState &&
    BLOCKED_STATES.has(
      contribution.workflowState
    )
  ) {
    return true;
  }

  return (
    contribution.readiness ===
      "NOT_READY" &&
    contribution.nextActor !==
      "MAINTAINER"
  );
}

export function buildRepositoryDashboard(
  overview: RepositoryOverview
): RepositoryDashboard {
  const byWorkflowState:
    Record<string, number> = {};
  const byReadiness:
    Record<string, number> = {};
  const byNextActor:
    Record<string, number> = {};

  let active = 0;
  let terminal = 0;
  let ambiguous = 0;
  let blocked = 0;
  let readyForReview = 0;
  let readyForRereview = 0;
  let readyToMerge = 0;
  let readyForRelease = 0;
  let maintainerAction = 0;
  let authorAction = 0;
  let ciAction = 0;
  let unknownAction = 0;

  let highestPullRequestNumber:
    number | null = null;
  let oldestUnreconciledAt:
    Date | null = null;

  for (
    const contribution
    of overview.contributions
  ) {
    increment(
      byWorkflowState,
      contribution.workflowState
    );
    increment(
      byReadiness,
      contribution.readiness
    );
    increment(
      byNextActor,
      contribution.nextActor
    );

    if (
      contribution.workflowState &&
      TERMINAL_STATES.has(
        contribution.workflowState
      )
    ) {
      terminal += 1;
    } else {
      active += 1;
    }

    if (
      contribution.workflowState ===
        "AMBIGUOUS" ||
      contribution.readiness ===
        "AMBIGUOUS"
    ) {
      ambiguous += 1;
    }

    if (isBlocked(contribution)) {
      blocked += 1;
    }

    if (
      contribution.readiness ===
      "READY_FOR_REVIEW"
    ) {
      readyForReview += 1;
    }

    if (
      contribution.readiness ===
      "READY_FOR_REREVIEW"
    ) {
      readyForRereview += 1;
    }

    if (
      contribution.readiness ===
      "READY_TO_MERGE"
    ) {
      readyToMerge += 1;
    }

    if (
      contribution.readiness ===
      "READY_FOR_RELEASE"
    ) {
      readyForRelease += 1;
    }

    if (
      contribution.nextActor ===
      "MAINTAINER"
    ) {
      maintainerAction += 1;
    } else if (
      contribution.nextActor ===
      "AUTHOR"
    ) {
      authorAction += 1;
    } else if (
      contribution.nextActor ===
      "CI"
    ) {
      ciAction += 1;
    } else if (
      contribution.nextActor ===
        "UNKNOWN" ||
      contribution.nextActor === null
    ) {
      unknownAction += 1;
    }

    if (
      highestPullRequestNumber ===
        null ||
      contribution.pullRequestNumber >
        highestPullRequestNumber
    ) {
      highestPullRequestNumber =
        contribution.pullRequestNumber;
    }

    if (
      contribution.lastReconciledAt
    ) {
      if (
        !oldestUnreconciledAt ||
        contribution
          .lastReconciledAt <
          oldestUnreconciledAt
      ) {
        oldestUnreconciledAt =
          contribution
            .lastReconciledAt;
      }
    }
  }

  return {
    repository: overview.repository,
    totals: {
      contributions:
        overview.contributionCount,
      active,
      terminal,
      ambiguous,
      blocked,
      readyForReview,
      readyForRereview,
      readyToMerge,
      readyForRelease,
      maintainerAction,
      authorAction,
      ciAction,
      unknownAction
    },
    byWorkflowState,
    byReadiness,
    byNextActor,
    highestPullRequestNumber,
    oldestUnreconciledAt
  };
}

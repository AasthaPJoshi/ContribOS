export interface AttentionCandidate {
  contributionId: string;
  repositoryId: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  url: string;
  updatedAt: Date;
  lastReconciledAt: Date | null;
  workflowState: string | null;
  nextActor: string | null;
  readiness: string | null;
  reasonCode: string | null;
}

export interface AttentionQueueFilters {
  workflowState?: string;
  readiness?: string;
  nextActor?: string;
}

export interface AttentionQueueOptions {
  page?: number;
  pageSize?: number;
  filters?: AttentionQueueFilters;
}

export interface AttentionQueueItem extends AttentionCandidate {
  priorityScore: number;
  priorityBand: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  priorityReasons: string[];
}

export interface AttentionQueuePage {
  items: AttentionQueueItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const TERMINAL_STATES = new Set([
  "MERGED",
  "RELEASED",
  "CLOSED"
]);

function assertPagination(
  page: number,
  pageSize: number
): void {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error(
      "attention queue page must be a positive integer."
    );
  }

  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new Error(
      "attention queue pageSize must be between 1 and 100."
    );
  }
}

function computePriority(
  candidate: AttentionCandidate
): Pick<
  AttentionQueueItem,
  "priorityScore" | "priorityBand" | "priorityReasons"
> {
  let priorityScore = 0;
  const priorityReasons: string[] = [];

  if (candidate.workflowState === "AMBIGUOUS") {
    priorityScore += 100;
    priorityReasons.push("AMBIGUOUS_STATE");
  }

  if (candidate.readiness === "READY_TO_MERGE") {
    priorityScore += 90;
    priorityReasons.push("READY_TO_MERGE");
  }

  if (candidate.nextActor === "MAINTAINER") {
    priorityScore += 80;
    priorityReasons.push("MAINTAINER_IS_NEXT_ACTOR");
  }

  if (
    candidate.readiness === "READY_FOR_REVIEW" ||
    candidate.readiness === "READY_FOR_REREVIEW"
  ) {
    priorityScore += 60;
    priorityReasons.push(candidate.readiness);
  }

  if (candidate.workflowState === "IN_REVIEW") {
    priorityScore += 40;
    priorityReasons.push("IN_REVIEW");
  }

  if (candidate.nextActor === "UNKNOWN") {
    priorityScore += 35;
    priorityReasons.push("UNKNOWN_NEXT_ACTOR");
  }

  if (candidate.readiness === "AMBIGUOUS") {
    priorityScore += 35;
    priorityReasons.push("AMBIGUOUS_READINESS");
  }

  const priorityBand: AttentionQueueItem["priorityBand"] =
    priorityScore >= 140
      ? "CRITICAL"
      : priorityScore >= 90
        ? "HIGH"
        : priorityScore >= 50
          ? "NORMAL"
          : "LOW";

  return {
    priorityScore,
    priorityBand,
    priorityReasons
  };
}

function matchesFilters(
  candidate: AttentionCandidate,
  filters: AttentionQueueFilters
): boolean {
  if (
    filters.workflowState &&
    candidate.workflowState !== filters.workflowState
  ) {
    return false;
  }

  if (
    filters.readiness &&
    candidate.readiness !== filters.readiness
  ) {
    return false;
  }

  if (
    filters.nextActor &&
    candidate.nextActor !== filters.nextActor
  ) {
    return false;
  }

  return true;
}

export function buildMaintainerAttentionQueue(
  candidates: readonly AttentionCandidate[],
  options: AttentionQueueOptions = {}
): AttentionQueuePage {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;
  const filters = options.filters ?? {};

  assertPagination(page, pageSize);

  const ranked = candidates
    .filter(
      (candidate) =>
        !candidate.workflowState ||
        !TERMINAL_STATES.has(candidate.workflowState)
    )
    .filter((candidate) => matchesFilters(candidate, filters))
    .map((candidate) => ({
      ...candidate,
      ...computePriority(candidate)
    }))
    .sort((left, right) => {
      const scoreDifference =
        right.priorityScore - left.priorityScore;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const updatedDifference =
        left.updatedAt.getTime() - right.updatedAt.getTime();

      if (updatedDifference !== 0) {
        return updatedDifference;
      }

      const repositoryDifference =
        left.repositoryFullName.localeCompare(
          right.repositoryFullName
        );

      if (repositoryDifference !== 0) {
        return repositoryDifference;
      }

      return left.pullRequestNumber - right.pullRequestNumber;
    });

  const total = ranked.length;
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;

  return {
    items: ranked.slice(offset, offset + pageSize),
    page,
    pageSize,
    total,
    totalPages
  };
}

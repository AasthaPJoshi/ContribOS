export type WorkerJobType =
  | "RECONCILE_PULL_REQUEST"
  | "RECONCILIATION_SWEEP";

export interface ReconcilePullRequestJobPayload {
  installationId: number;
  repositoryId: number;
  pullRequestNumber: number;
}

export interface ReconciliationSweepJobPayload {
  installationId: number;
  repositoryId?: number | null;
}

export interface WorkerJobPayloadMap {
  RECONCILE_PULL_REQUEST:
    ReconcilePullRequestJobPayload;
  RECONCILIATION_SWEEP:
    ReconciliationSweepJobPayload;
}

export interface WorkerJob<
  T extends WorkerJobType = WorkerJobType
> {
  id: string;
  type: T;
  payload: WorkerJobPayloadMap[T];
  deduplicationKey: string;
  attempt: number;
  maxAttempts: number;
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

import type {
  ReconcilePullRequestJobPayload,
  ReconciliationSweepJobPayload,
  WorkerJob,
  WorkerJobHandler
} from "@contribos/worker";

export interface PullRequestJobExecutor {
  execute(
    payload:
      ReconcilePullRequestJobPayload
  ): Promise<void>;
}

export interface SweepJobExecutor {
  execute(
    payload:
      ReconciliationSweepJobPayload
  ): Promise<void>;
}

export class ApplicationJobHandler
  implements WorkerJobHandler
{
  constructor(
    private readonly pullRequests:
      PullRequestJobExecutor,
    private readonly sweeps:
      SweepJobExecutor
  ) {}

  async handle(
    job: WorkerJob
  ): Promise<void> {
    switch (job.type) {
      case "RECONCILE_PULL_REQUEST":
        await this.pullRequests.execute(
          job.payload as
            ReconcilePullRequestJobPayload
        );
        return;

      case "RECONCILIATION_SWEEP":
        await this.sweeps.execute(
          job.payload as
            ReconciliationSweepJobPayload
        );
        return;

      default: {
        const neverJob:
          never = job.type;

        throw new Error(
          `Unsupported worker job type: ${String(
            neverJob
          )}`
        );
      }
    }
  }
}

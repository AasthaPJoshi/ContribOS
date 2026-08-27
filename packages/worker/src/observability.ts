import type { WorkerJob } from "./job-types.js";

export interface WorkerObserver {
  jobClaimed?(job: WorkerJob): void | Promise<void>;
  jobCompleted?(job: WorkerJob): void | Promise<void>;
  jobRescheduled?(
    job: WorkerJob,
    nextAttempt: number,
    availableAt: Date
  ): void | Promise<void>;
  jobDead?(job: WorkerJob, errorCode: string): void | Promise<void>;
  workerIdle?(): void | Promise<void>;
}

export const NOOP_WORKER_OBSERVER: WorkerObserver = {};

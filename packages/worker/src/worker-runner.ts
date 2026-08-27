import { classifyWorkerFailure } from "./failure-classification.js";
import type { JobStore } from "./job-store.js";
import type { WorkerJob } from "./job-types.js";
import {
  NOOP_WORKER_OBSERVER,
  type WorkerObserver
} from "./observability.js";
import {
  DEFAULT_WORKER_RETRY_POLICY,
  getWorkerRetryDelayMs,
  type WorkerRetryPolicy
} from "./retry-policy.js";

export interface WorkerJobHandler {
  handle(job: WorkerJob): Promise<void>;
}

export interface WorkerRunnerOptions {
  now?: () => Date;
  retryPolicy?: WorkerRetryPolicy;
  observer?: WorkerObserver;
}

export type WorkerRunResult =
  | { status: "IDLE" }
  | { status: "COMPLETED"; jobId: string }
  | {
      status: "RESCHEDULED";
      jobId: string;
      nextAttempt: number;
      availableAt: Date;
      errorCode: string;
    }
  | {
      status: "DEAD";
      jobId: string;
      attempt: number;
      errorCode: string;
    };

export class WorkerRunner {
  private readonly now: () => Date;
  private readonly retryPolicy: WorkerRetryPolicy;
  private readonly observer: WorkerObserver;

  constructor(
    private readonly store: JobStore,
    private readonly handler: WorkerJobHandler,
    options: WorkerRunnerOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.retryPolicy =
      options.retryPolicy ?? DEFAULT_WORKER_RETRY_POLICY;
    this.observer = options.observer ?? NOOP_WORKER_OBSERVER;
  }

  async runOnce(): Promise<WorkerRunResult> {
    const job = await this.store.claimNext(this.now());

    if (!job) {
      await this.observer.workerIdle?.();
      return { status: "IDLE" };
    }

    await this.observer.jobClaimed?.(job);

    try {
      await this.handler.handle(job);
      await this.store.markCompleted(job.id);
      await this.observer.jobCompleted?.(job);

      return {
        status: "COMPLETED",
        jobId: job.id
      };
    } catch (error) {
      const failure = classifyWorkerFailure(error);
      const nextAttempt = job.attempt + 1;

      if (!failure.retryable || nextAttempt >= job.maxAttempts) {
        await this.store.markDead(job.id);
        await this.observer.jobDead?.(job, failure.code);

        return {
          status: "DEAD",
          jobId: job.id,
          attempt: nextAttempt,
          errorCode: failure.code
        };
      }

      const availableAt = new Date(
        this.now().getTime() +
          getWorkerRetryDelayMs(nextAttempt, this.retryPolicy)
      );

      await this.store.reschedule(
        job.id,
        nextAttempt,
        availableAt
      );

      await this.observer.jobRescheduled?.(
        job,
        nextAttempt,
        availableAt
      );

      return {
        status: "RESCHEDULED",
        jobId: job.id,
        nextAttempt,
        availableAt,
        errorCode: failure.code
      };
    }
  }
}

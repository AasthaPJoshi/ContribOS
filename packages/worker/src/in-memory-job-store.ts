import type {
  EnqueueJobInput,
  JobStore
} from "./job-store.js";
import type {
  WorkerJob,
  WorkerJobType
} from "./job-types.js";

type InternalStatus =
  | "QUEUED"
  | "CLAIMED"
  | "COMPLETED"
  | "DEAD";

interface InternalJob {
  job: WorkerJob;
  status: InternalStatus;
}

export class InMemoryJobStore
  implements JobStore
{
  private readonly jobs =
    new Map<string, InternalJob>();

  private readonly dedupe =
    new Map<string, string>();

  async enqueue<T extends WorkerJobType>(
    input: EnqueueJobInput<T>
  ): Promise<boolean> {
    if (
      this.dedupe.has(
        input.deduplicationKey
      )
    ) {
      return false;
    }

    const job: WorkerJob<T> = {
      id: input.id,
      type: input.type,
      payload: input.payload,
      deduplicationKey:
        input.deduplicationKey,
      attempt: 0,
      maxAttempts: input.maxAttempts,
      availableAt: input.availableAt,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };

    this.jobs.set(input.id, {
      job,
      status: "QUEUED"
    });

    this.dedupe.set(
      input.deduplicationKey,
      input.id
    );

    return true;
  }

  async claimNext(
    now: Date
  ): Promise<WorkerJob | null> {
    const candidates = [...this.jobs.values()]
      .filter(
        (entry) =>
          entry.status === "QUEUED" &&
          entry.job.availableAt <= now
      )
      .sort(
        (a, b) =>
          a.job.availableAt.getTime() -
          b.job.availableAt.getTime()
      );

    const next = candidates[0];

    if (!next) {
      return null;
    }

    next.status = "CLAIMED";
    next.job.updatedAt = now;

    return {
      ...next.job
    };
  }

  async markCompleted(
    jobId: string
  ): Promise<void> {
    const entry = this.jobs.get(jobId);

    if (!entry) {
      return;
    }

    entry.status = "COMPLETED";
    entry.job.updatedAt = new Date();

    this.dedupe.delete(
      entry.job.deduplicationKey
    );
  }

  async reschedule(
    jobId: string,
    nextAttempt: number,
    availableAt: Date,
    _errorCode?: string,
    _errorMessage?: string
  ): Promise<void> {
    const entry = this.jobs.get(jobId);

    if (!entry) {
      return;
    }

    entry.status = "QUEUED";
    entry.job.attempt = nextAttempt;
    entry.job.availableAt = availableAt;
    entry.job.updatedAt = new Date();
  }

  async markDead(
    jobId: string,
    _errorCode?: string,
    _errorMessage?: string
  ): Promise<void> {
    const entry = this.jobs.get(jobId);

    if (!entry) {
      return;
    }

    entry.status = "DEAD";
    entry.job.updatedAt = new Date();

    this.dedupe.delete(
      entry.job.deduplicationKey
    );
  }

  async release(
    jobId: string
  ): Promise<void> {
    const entry = this.jobs.get(jobId);

    if (!entry || entry.status !== "CLAIMED") {
      return;
    }

    entry.status = "QUEUED";
    entry.job.updatedAt = new Date();
  }

  async get(
    jobId: string
  ): Promise<WorkerJob | null> {
    const entry = this.jobs.get(jobId);

    return entry
      ? { ...entry.job }
      : null;
  }
}

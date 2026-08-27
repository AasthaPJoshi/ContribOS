import type {
  WorkerJob,
  WorkerJobPayloadMap,
  WorkerJobType
} from "./job-types.js";

export interface EnqueueJobInput<
  T extends WorkerJobType
> {
  id: string;
  type: T;
  payload: WorkerJobPayloadMap[T];
  deduplicationKey: string;
  maxAttempts: number;
  availableAt: Date;
  createdAt: Date;
}

export interface JobStore {
  enqueue<T extends WorkerJobType>(
    input: EnqueueJobInput<T>
  ): Promise<boolean>;

  claimNext(now: Date): Promise<WorkerJob | null>;

  markCompleted(jobId: string): Promise<void>;

  reschedule(
    jobId: string,
    nextAttempt: number,
    availableAt: Date
  ): Promise<void>;

  markDead(jobId: string): Promise<void>;

  release(jobId: string): Promise<void>;

  get(jobId: string): Promise<WorkerJob | null>;
}

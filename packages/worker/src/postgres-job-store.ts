import type { WorkerJobRepository } from "@contribos/db";

import type { EnqueueJobInput, JobStore } from "./job-store.js";
import type { WorkerJob, WorkerJobType } from "./job-types.js";

function toWorkerJob(row: Awaited<ReturnType<WorkerJobRepository["findById"]>>): WorkerJob | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: row.type as WorkerJobType,
    payload: row.payload as WorkerJob["payload"],
    deduplicationKey: row.deduplicationKey,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class PostgresJobStore implements JobStore {
  constructor(private readonly repository: WorkerJobRepository) {}

  async enqueue<T extends WorkerJobType>(
    input: EnqueueJobInput<T>
  ): Promise<boolean> {
    return this.repository.enqueue(input);
  }

  async claimNext(now: Date): Promise<WorkerJob | null> {
    return toWorkerJob(await this.repository.claimNext(now));
  }

  async markCompleted(jobId: string): Promise<void> {
    await this.repository.markCompleted(jobId, new Date());
  }

  async reschedule(
    jobId: string,
    nextAttempt: number,
    availableAt: Date
  ): Promise<void> {
    await this.repository.reschedule(
      jobId,
      nextAttempt,
      availableAt,
      new Date()
    );
  }

  async markDead(jobId: string): Promise<void> {
    await this.repository.markDead(jobId, new Date());
  }

  async release(jobId: string): Promise<void> {
    const row = await this.repository.findById(jobId);

    if (!row || row.status !== "CLAIMED") {
      return;
    }

    await this.repository.reschedule(
      jobId,
      row.attempt,
      new Date(),
      new Date()
    );
  }

  async get(jobId: string): Promise<WorkerJob | null> {
    return toWorkerJob(await this.repository.findById(jobId));
  }
}

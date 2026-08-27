import { and, eq, lt, sql } from "drizzle-orm";

import type { ContribOSDatabase } from "../database.js";
import { workerJobs, type WorkerJobRow } from "../schema.js";

export interface EnqueueWorkerJobInput {
  id: string;
  type: string;
  payload: unknown;
  deduplicationKey: string;
  maxAttempts: number;
  availableAt: Date;
  createdAt: Date;
}

export class WorkerJobRepository {
  constructor(private readonly db: ContribOSDatabase) {}

  async enqueue(input: EnqueueWorkerJobInput): Promise<boolean> {
    const rows = await this.db
      .insert(workerJobs)
      .values({
        id: input.id,
        type: input.type,
        payload: input.payload,
        deduplicationKey: input.deduplicationKey,
        status: "QUEUED",
        attempt: 0,
        maxAttempts: input.maxAttempts,
        availableAt: input.availableAt,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      })
      .onConflictDoNothing({ target: workerJobs.deduplicationKey })
      .returning({ id: workerJobs.id });

    return rows.length === 1;
  }

  async claimNext(now: Date): Promise<WorkerJobRow | null> {
    return this.db.transaction(async (tx) => {
      const result = await tx.execute<{ id: string }>(sql`
        SELECT ${workerJobs.id} AS id
        FROM ${workerJobs}
        WHERE ${workerJobs.status} = 'QUEUED'
          AND ${workerJobs.availableAt} <= ${now}
        ORDER BY ${workerJobs.availableAt} ASC, ${workerJobs.createdAt} ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);

      const candidate = result.rows[0];
      if (!candidate) return null;

      const rows = await tx
        .update(workerJobs)
        .set({
          status: "CLAIMED",
          claimedAt: now,
          updatedAt: now
        })
        .where(
          and(
            eq(workerJobs.id, candidate.id),
            eq(workerJobs.status, "QUEUED")
          )
        )
        .returning();

      return rows[0] ?? null;
    });
  }

  async markCompleted(id: string, now: Date): Promise<void> {
    await this.db
      .update(workerJobs)
      .set({
        status: "COMPLETED",
        completedAt: now,
        claimedAt: null,
        updatedAt: now
      })
      .where(eq(workerJobs.id, id));
  }

  async reschedule(
    id: string,
    attempt: number,
    availableAt: Date,
    now: Date
  ): Promise<void> {
    await this.db
      .update(workerJobs)
      .set({
        status: "QUEUED",
        attempt,
        availableAt,
        claimedAt: null,
        updatedAt: now
      })
      .where(eq(workerJobs.id, id));
  }

  async markDead(id: string, now: Date): Promise<void> {
    await this.db
      .update(workerJobs)
      .set({
        status: "DEAD",
        deadAt: now,
        claimedAt: null,
        updatedAt: now
      })
      .where(eq(workerJobs.id, id));
  }

  async recoverStaleClaims(staleBefore: Date, now: Date): Promise<WorkerJobRow[]> {
    return this.db
      .update(workerJobs)
      .set({
        status: "QUEUED",
        claimedAt: null,
        availableAt: now,
        lastErrorCode: "STALE_CLAIM",
        updatedAt: now
      })
      .where(
        and(
          eq(workerJobs.status, "CLAIMED"),
          lt(workerJobs.claimedAt, staleBefore)
        )
      )
      .returning();
  }

  async findById(id: string): Promise<WorkerJobRow | null> {
    const rows = await this.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.id, id))
      .limit(1);

    return rows[0] ?? null;
  }
}

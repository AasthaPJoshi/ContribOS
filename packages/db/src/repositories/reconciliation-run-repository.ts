import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { PullRequestReconciliationResult } from "@contribos/github";

import type { ContribOSDatabase } from "../database.js";
import {
  reconciliationRuns,
  type ReconciliationRunRow
} from "../schema.js";
import { requireReturnedRow } from "./helpers.js";

export interface AppendReconciliationRunInput {
  contributionId: string;
  result: PullRequestReconciliationResult;
  startedAt: Date;
  completedAt: Date;
}

export class ReconciliationRunRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async listByContributionId(
    contributionId: string,
    limit = 100
  ): Promise<ReconciliationRunRow[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("reconciliation run limit must be between 1 and 500.");
    }

    return this.db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.contributionId, contributionId))
      .orderBy(desc(reconciliationRuns.completedAt), desc(reconciliationRuns.createdAt))
      .limit(limit);
  }

  async append(
    input: AppendReconciliationRunInput
  ): Promise<ReconciliationRunRow> {
    const rows = await this.db
      .insert(reconciliationRuns)
      .values({
        id: randomUUID(),
        contributionId:
          input.contributionId,
        status: input.result.status,
        reasonCode:
          input.result.reasonCode,
        headSha: input.result.headSha,
        repairAction:
          input.result.repairDecision.action,
        driftFields:
          input.result.drift?.fields ?? [],
        result: input.result,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        createdAt: new Date()
      })
      .returning();

    return requireReturnedRow(
      rows,
      "reconciliation run append"
    );
  }
}

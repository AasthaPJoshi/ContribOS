import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { StateEvaluation } from "@contribos/domain";

import type { ContribOSDatabase } from "../database.js";
import {
  stateEvaluations,
  type StateEvaluationRow
} from "../schema.js";
import { requireReturnedRow } from "./helpers.js";

export class StateEvaluationRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async findLatestByContributionId(
    contributionId: string
  ): Promise<StateEvaluationRow | null> {
    const rows = await this.db
      .select()
      .from(stateEvaluations)
      .where(eq(stateEvaluations.contributionId, contributionId))
      .orderBy(desc(stateEvaluations.evaluatedAt), desc(stateEvaluations.createdAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async append(
    contributionId: string,
    evaluation: StateEvaluation
  ): Promise<StateEvaluationRow> {
    const rows = await this.db
      .insert(stateEvaluations)
      .values({
        id: randomUUID(),
        contributionId,
        workflowState:
          evaluation.workflowState,
        nextActor: evaluation.nextActor,
        readiness: evaluation.readiness,
        reasonCode: evaluation.reasonCode,
        explanation: evaluation.explanation,
        engineVersion:
          evaluation.engineVersion,
        evaluatedAt: evaluation.evaluatedAt,
        evaluation,
        createdAt: new Date()
      })
      .returning();

    return requireReturnedRow(
      rows,
      "state evaluation append"
    );
  }
}

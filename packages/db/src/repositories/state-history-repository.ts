import { randomUUID } from "node:crypto";

import type { ContribOSDatabase } from "../database.js";
import {
  stateHistory,
  type StateHistoryRow
} from "../schema.js";
import { requireReturnedRow } from "./helpers.js";

export interface AppendStateHistoryInput {
  contributionId: string;
  evaluationId: string;
  fromState?: string | null;
  toState: string;
  reasonCode: string;
  changedAt: Date;
}

export class StateHistoryRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async append(
    input: AppendStateHistoryInput
  ): Promise<StateHistoryRow> {
    const rows = await this.db
      .insert(stateHistory)
      .values({
        id: randomUUID(),
        contributionId:
          input.contributionId,
        evaluationId: input.evaluationId,
        fromState: input.fromState ?? null,
        toState: input.toState,
        reasonCode: input.reasonCode,
        changedAt: input.changedAt,
        createdAt: new Date()
      })
      .returning();

    return requireReturnedRow(
      rows,
      "state history append"
    );
  }
}

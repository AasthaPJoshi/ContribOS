import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  contributions,
  evidence,
  installations,
  reconciliationRuns,
  repositories,
  stateEvaluations,
  stateHistory,
  webhookDeliveries
} from "../src/schema.js";

describe("ContribOS persistence schema", () => {
  it("exports the eight Phase 4 core tables", () => {
    expect(
      [
        installations,
        repositories,
        contributions,
        webhookDeliveries,
        evidence,
        stateEvaluations,
        reconciliationRuns,
        stateHistory
      ].map((table) => getTableName(table))
    ).toEqual([
      "installations",
      "repositories",
      "contributions",
      "webhook_deliveries",
      "evidence",
      "state_evaluations",
      "reconciliation_runs",
      "state_history"
    ]);
  });
});

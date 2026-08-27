import {
  describe,
  expect,
  it
} from "vitest";

import {
  contributionStateSummary,
  decisionTrailSummary
} from "../src/product/contribution-view-model.js";

describe(
  "contribution detail view model",
  () => {
    it("builds a readable current state summary", () => {
      const result =
        contributionStateSummary({
          repository: {} as never,
          contribution: {} as never,
          currentState: {
            workflowState:
              "READY_TO_MERGE",
            nextActor:
              "MAINTAINER",
            readiness:
              "READY_TO_MERGE",
            reasonCode:
              "READY_TO_MERGE",
            explanation:
              "Approved and green.",
            evaluatedAt:
              "2026-08-27T00:00:00Z"
          }
        });

      expect(result).toEqual({
        workflowState:
          "Ready To Merge",
        nextActor: "Maintainer",
        readiness:
          "Ready To Merge",
        reasonCode:
          "Ready To Merge",
        explanation:
          "Approved and green."
      });
    });

    it("handles a missing evaluation", () => {
      const result =
        contributionStateSummary({
          repository: {} as never,
          contribution: {} as never,
          currentState: null
        });

      expect(
        result.workflowState
      ).toBe("Unknown");
      expect(
        result.nextActor
      ).toBe("Unknown");
    });

    it("summarizes decision trail activity", () => {
      const summary =
        decisionTrailSummary({
          stateHistory: [
            {} as never,
            {} as never
          ],
          evidence: [
            {} as never,
            {} as never,
            {} as never
          ],
          reconciliationRuns: [
            {
              status: "COMPLETED",
              driftFields: []
            } as never,
            {
              status: "FAILED",
              driftFields: [
                "mergeable"
              ]
            } as never
          ]
        });

      expect(summary).toEqual({
        stateChanges: 2,
        evidenceItems: 3,
        reconciliationRuns: 2,
        failedRuns: 1,
        driftEvents: 1
      });
    });
  }
);

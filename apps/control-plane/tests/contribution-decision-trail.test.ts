import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildContributionDecisionTrail
} from "../src/contribution-decision-trail.js";

describe("contribution decision trail", () => {
  it("maps state, evidence, and reconciliation history without exposing raw payloads", () => {
    const trail =
      buildContributionDecisionTrail(
        [
          {
            id: "history-1",
            contributionId:
              "contribution-1",
            evaluationId:
              "evaluation-1",
            fromState: "IN_REVIEW",
            toState: "READY_TO_MERGE",
            reasonCode:
              "READY_TO_MERGE",
            changedAt:
              new Date(
                "2026-08-27T00:00:00Z"
              ),
            createdAt:
              new Date(
                "2026-08-27T00:00:01Z"
              )
          }
        ],
        [
          {
            id: "evidence-row-1",
            contributionId:
              "contribution-1",
            evidenceId:
              "review:123",
            source: "GITHUB",
            objectType: "REVIEW",
            externalId: "123",
            url:
              "https://example.test/review/123",
            occurredAt:
              new Date(
                "2026-08-27T00:00:00Z"
              ),
            payload: {
              secret: "not-exposed"
            },
            capturedAt:
              new Date(
                "2026-08-27T00:00:01Z"
              ),
            createdAt:
              new Date(
                "2026-08-27T00:00:01Z"
              )
          }
        ],
        [
          {
            id: "run-1",
            contributionId:
              "contribution-1",
            status: "STABLE",
            reasonCode: "STABLE",
            headSha: "abc123",
            repairAction: "NONE",
            driftFields: [],
            result: {
              internal: "not-exposed"
            },
            startedAt:
              new Date(
                "2026-08-27T00:00:00Z"
              ),
            completedAt:
              new Date(
                "2026-08-27T00:00:02Z"
              ),
            createdAt:
              new Date(
                "2026-08-27T00:00:02Z"
              )
          }
        ]
      );

    expect(
      trail.stateHistory[0]
        ?.toState
    ).toBe("READY_TO_MERGE");

    expect(
      trail.evidence[0]
        ?.objectType
    ).toBe("REVIEW");

    expect(
      trail.reconciliationRuns[0]
        ?.status
    ).toBe("STABLE");

    expect(
      "payload" in
        (trail.evidence[0] ?? {})
    ).toBe(false);

    expect(
      "result" in
        (trail.reconciliationRuns[0] ?? {})
    ).toBe(false);
  });
});

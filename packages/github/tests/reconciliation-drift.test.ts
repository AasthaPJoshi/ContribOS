import { describe, expect, it } from "vitest";

import {
  comparePullRequestSnapshots,
  decideReconciliationRepair
} from "../src/reconciliation-drift.js";
import type { PullRequestSnapshot } from "@contribos/domain";

function snapshot(
  overrides: Partial<PullRequestSnapshot> = {}
): PullRequestSnapshot {
  return {
    evidence: [],
    isDraft: false,
    isOpen: true,
    isMerged: false,
    hasMergeConflict: false,
    checkStatus: "SUCCESS",
    reviewDecision: "APPROVED",
    authorHasChangesToMake: false,
    maintainerReviewRequired: false,
    ...overrides
  };
}

describe("reconciliation drift", () => {
  it("identifies exact authoritative field drift", () => {
    const drift = comparePullRequestSnapshots(
      snapshot({
        checkStatus: "PENDING"
      }),
      snapshot()
    );

    expect(drift).toEqual({
      changed: true,
      fields: ["checkStatus"]
    });
  });

  it("replaces observed state when drift exists", () => {
    const decision = decideReconciliationRepair(
      snapshot({
        checkStatus: "PENDING"
      }),
      snapshot(),
      true
    );

    expect(decision).toEqual({
      action: "REPLACE_WITH_AUTHORITATIVE",
      reasonCode: "AUTHORITATIVE_DRIFT_DETECTED"
    });
  });

  it("defers repair when reconciliation is unstable", () => {
    expect(
      decideReconciliationRepair(
        snapshot(),
        snapshot(),
        false
      )
    ).toEqual({
      action: "DEFER",
      reasonCode: "RECONCILIATION_NOT_STABLE"
    });
  });
});

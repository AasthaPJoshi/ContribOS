import type { PullRequestSnapshot } from "@contribos/domain";

export interface ReconciliationDrift {
  changed: boolean;
  fields: string[];
}

export type ReconciliationRepairAction =
  | "NO_CHANGE"
  | "REPLACE_WITH_AUTHORITATIVE"
  | "DEFER";

export interface ReconciliationRepairDecision {
  action: ReconciliationRepairAction;
  reasonCode: string;
}

const SNAPSHOT_FIELDS = [
  "isDraft",
  "isOpen",
  "isMerged",
  "hasMergeConflict",
  "checkStatus",
  "reviewDecision",
  "authorHasChangesToMake",
  "maintainerReviewRequired"
] as const satisfies readonly (keyof PullRequestSnapshot)[];

export function comparePullRequestSnapshots(
  observed: PullRequestSnapshot,
  authoritative: PullRequestSnapshot
): ReconciliationDrift {
  const fields: string[] = [];

  for (const field of SNAPSHOT_FIELDS) {
    if (observed[field] !== authoritative[field]) {
      fields.push(field);
    }
  }

  return {
    changed: fields.length > 0,
    fields
  };
}

export function decideReconciliationRepair(
  observed: PullRequestSnapshot | null,
  authoritative: PullRequestSnapshot | null,
  canRepair: boolean
): ReconciliationRepairDecision {
  if (!canRepair || authoritative === null) {
    return {
      action: "DEFER",
      reasonCode: "RECONCILIATION_NOT_STABLE"
    };
  }

  if (observed === null) {
    return {
      action: "REPLACE_WITH_AUTHORITATIVE",
      reasonCode: "AUTHORITATIVE_BASELINE"
    };
  }

  const drift = comparePullRequestSnapshots(
    observed,
    authoritative
  );

  if (drift.changed) {
    return {
      action: "REPLACE_WITH_AUTHORITATIVE",
      reasonCode: "AUTHORITATIVE_DRIFT_DETECTED"
    };
  }

  return {
    action: "NO_CHANGE",
    reasonCode: "AUTHORITATIVE_STATE_MATCHES"
  };
}

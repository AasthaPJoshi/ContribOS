import type {
  ContributionDecisionTrail,
  ContributionDetail
} from "../api/types.js";
import {
  humanizeToken
} from "./dashboard-view-model.js";

export interface ContributionStateSummary {
  workflowState: string;
  nextActor: string;
  readiness: string;
  reasonCode: string;
  explanation: string;
}

export interface DecisionTrailSummary {
  stateChanges: number;
  evidenceItems: number;
  reconciliationRuns: number;
  failedRuns: number;
  driftEvents: number;
}

export function contributionStateSummary(
  detail: ContributionDetail
): ContributionStateSummary {
  const state = detail.currentState;

  if (!state) {
    return {
      workflowState: "Unknown",
      nextActor: "Unknown",
      readiness: "Unknown",
      reasonCode: "Unknown",
      explanation:
        "ContribOS has not recorded a current state evaluation."
    };
  }

  return {
    workflowState:
      humanizeToken(state.workflowState),
    nextActor:
      humanizeToken(state.nextActor),
    readiness:
      humanizeToken(state.readiness),
    reasonCode:
      humanizeToken(state.reasonCode),
    explanation: state.explanation
  };
}

export function decisionTrailSummary(
  trail: ContributionDecisionTrail
): DecisionTrailSummary {
  return {
    stateChanges:
      trail.stateHistory.length,
    evidenceItems:
      trail.evidence.length,
    reconciliationRuns:
      trail.reconciliationRuns.length,
    failedRuns:
      trail.reconciliationRuns.filter(
        (run) =>
          run.status !== "COMPLETED" &&
          run.status !== "SUCCESS"
      ).length,
    driftEvents:
      trail.reconciliationRuns.filter(
        (run) =>
          run.driftFields.length > 0
      ).length
  };
}

export function formatTimestamp(
  value: string | null
): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return date.toLocaleString();
}

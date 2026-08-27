import type {
  EvidenceRow,
  ReconciliationRunRow,
  StateHistoryRow
} from "@contribos/db";

export interface ContributionDecisionTrail {
  stateHistory: {
    id: string;
    evaluationId: string;
    fromState: string | null;
    toState: string;
    reasonCode: string;
    changedAt: Date;
  }[];
  evidence: {
    id: string;
    evidenceId: string;
    source: string;
    objectType: string;
    externalId: string;
    url: string;
    occurredAt: Date;
    capturedAt: Date;
  }[];
  reconciliationRuns: {
    id: string;
    status: string;
    reasonCode: string;
    headSha: string | null;
    repairAction: string;
    driftFields: string[];
    startedAt: Date;
    completedAt: Date;
  }[];
}

export function buildContributionDecisionTrail(
  stateHistory: readonly StateHistoryRow[],
  evidence: readonly EvidenceRow[],
  reconciliationRuns: readonly ReconciliationRunRow[]
): ContributionDecisionTrail {
  return {
    stateHistory: stateHistory.map((row) => ({
      id: row.id,
      evaluationId: row.evaluationId,
      fromState: row.fromState,
      toState: row.toState,
      reasonCode: row.reasonCode,
      changedAt: row.changedAt
    })),
    evidence: evidence.map((row) => ({
      id: row.id,
      evidenceId: row.evidenceId,
      source: row.source,
      objectType: row.objectType,
      externalId: row.externalId,
      url: row.url,
      occurredAt: row.occurredAt,
      capturedAt: row.capturedAt
    })),
    reconciliationRuns: reconciliationRuns.map((row) => ({
      id: row.id,
      status: row.status,
      reasonCode: row.reasonCode,
      headSha: row.headSha,
      repairAction: row.repairAction,
      driftFields: row.driftFields,
      startedAt: row.startedAt,
      completedAt: row.completedAt
    }))
  };
}

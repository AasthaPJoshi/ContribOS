import type {
  ContributionState,
  NextActor,
  Readiness,
  WorkflowState
} from "./contribution.js";

import type { EvidenceRef } from "./evidence.js";

export interface StateEvaluation {
  workflowState: WorkflowState;
  nextActor: NextActor;
  readiness: Readiness;

  reasonCode: string;
  explanation: string;

  evidence: EvidenceRef[];

  evaluatedAt: Date;
  engineVersion: string;
}

export interface ContributionSnapshot {
  contributionId: string;
  currentState: ContributionState;
  evidence: EvidenceRef[];
}

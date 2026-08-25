export type WorkflowState =
  | "DRAFT"
  | "OPEN"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "READY_TO_MERGE"
  | "MERGED"
  | "RELEASED"
  | "CLOSED"
  | "AMBIGUOUS";

export type NextActor =
  | "AUTHOR"
  | "REVIEWER"
  | "MAINTAINER"
  | "CI"
  | "RELEASE_MANAGER"
  | "SYSTEM"
  | "NONE"
  | "UNKNOWN";

export type Readiness =
  | "NOT_READY"
  | "READY_FOR_REVIEW"
  | "READY_FOR_REREVIEW"
  | "READY_TO_MERGE"
  | "READY_FOR_RELEASE"
  | "COMPLETE"
  | "AMBIGUOUS";

export interface ContributionState {
  workflowState: WorkflowState;
  nextActor: NextActor;
  readiness: Readiness;
}

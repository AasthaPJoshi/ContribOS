export type EvidenceSource = "GITHUB";

export type EvidenceObjectType =
  | "PULL_REQUEST"
  | "ISSUE"
  | "REVIEW"
  | "REVIEW_THREAD"
  | "CHECK_RUN"
  | "CHECK_SUITE"
  | "WORKFLOW_RUN"
  | "COMMIT"
  | "RELEASE"
  | "REPOSITORY";

export interface EvidenceRef {
  id: string;
  source: EvidenceSource;
  objectType: EvidenceObjectType;
  externalId: string;
  url: string;
  occurredAt: Date;
}

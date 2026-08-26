import type {
  EvidenceRef,
  PullRequestSnapshot
} from "@contribos/domain";

import type { GitHubPullRequestRecord } from "./pull-request-record.js";
import type { PullRequestPolicy } from "./reconciliation-policy.js";
import type {
  ReconciliationDrift,
  ReconciliationRepairDecision
} from "./reconciliation-drift.js";

export type PullRequestReconciliationStatus =
  | "READY"
  | "RETRY_REQUIRED"
  | "POLICY_UNRESOLVED";

export interface ReconcilePullRequestInput {
  installationId: number;
  repositoryId: number;
  owner: string;
  repository: string;
  pullRequestNumber: number;
  observedSnapshot?: PullRequestSnapshot | null;
}

export interface PullRequestReconciliationResult {
  status: PullRequestReconciliationStatus;
  reasonCode: string;
  record: GitHubPullRequestRecord | null;
  snapshot: PullRequestSnapshot | null;
  evidence: EvidenceRef[];
  headSha: string | null;
  reconciledAt: Date;
  policy: PullRequestPolicy | null;
  drift: ReconciliationDrift | null;
  repairDecision: ReconciliationRepairDecision;
}

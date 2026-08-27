import type {
  ReconcilePullRequestJobPayload,
  ReconciliationSweepJobPayload
} from "./job-types.js";

export function reconcilePullRequestDeduplicationKey(
  payload: ReconcilePullRequestJobPayload
): string {
  return [
    "reconcile-pr",
    payload.installationId,
    payload.repositoryId,
    payload.pullRequestNumber
  ].join(":");
}

export function reconciliationSweepDeduplicationKey(
  payload: ReconciliationSweepJobPayload
): string {
  return [
    "reconciliation-sweep",
    payload.installationId,
    payload.repositoryId ?? "all"
  ].join(":");
}

import { randomUUID } from "node:crypto";

import type { JobStore } from "./job-store.js";
import {
  reconcilePullRequestDeduplicationKey,
  reconciliationSweepDeduplicationKey
} from "./job-deduplication.js";
import type {
  ReconcilePullRequestJobPayload,
  ReconciliationSweepJobPayload
} from "./job-types.js";
import {
  DEFAULT_WORKER_RETRY_POLICY,
  type WorkerRetryPolicy
} from "./retry-policy.js";

export async function enqueueReconcilePullRequest(
  store: JobStore,
  payload: ReconcilePullRequestJobPayload,
  options: {
    now?: Date;
    retryPolicy?: WorkerRetryPolicy;
  } = {}
): Promise<boolean> {
  const now = options.now ?? new Date();
  const policy =
    options.retryPolicy ??
    DEFAULT_WORKER_RETRY_POLICY;

  return store.enqueue({
    id: randomUUID(),
    type: "RECONCILE_PULL_REQUEST",
    payload,
    deduplicationKey:
      reconcilePullRequestDeduplicationKey(
        payload
      ),
    maxAttempts: policy.maxAttempts,
    availableAt: now,
    createdAt: now
  });
}

export async function enqueueReconciliationSweep(
  store: JobStore,
  payload: ReconciliationSweepJobPayload,
  options: {
    now?: Date;
    retryPolicy?: WorkerRetryPolicy;
  } = {}
): Promise<boolean> {
  const now = options.now ?? new Date();
  const policy =
    options.retryPolicy ??
    DEFAULT_WORKER_RETRY_POLICY;

  return store.enqueue({
    id: randomUUID(),
    type: "RECONCILIATION_SWEEP",
    payload,
    deduplicationKey:
      reconciliationSweepDeduplicationKey(
        payload
      ),
    maxAttempts: policy.maxAttempts,
    availableAt: now,
    createdAt: now
  });
}

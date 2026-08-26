export interface ReconciliationRetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RECONCILIATION_RETRY_POLICY: ReconciliationRetryPolicy = {
  baseDelayMs: 250,
  maxDelayMs: 5_000
};

export function getReconciliationRetryDelayMs(
  attempt: number,
  policy: ReconciliationRetryPolicy =
    DEFAULT_RECONCILIATION_RETRY_POLICY
): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error("INVALID_RETRY_ATTEMPT");
  }

  if (policy.baseDelayMs < 0 || policy.maxDelayMs < 0) {
    throw new Error("INVALID_RETRY_POLICY");
  }

  return Math.min(
    policy.baseDelayMs * 2 ** (attempt - 1),
    policy.maxDelayMs
  );
}

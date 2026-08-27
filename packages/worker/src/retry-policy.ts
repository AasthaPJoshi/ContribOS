export interface WorkerRetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export const DEFAULT_WORKER_RETRY_POLICY:
  WorkerRetryPolicy = {
    baseDelayMs: 1_000,
    maxDelayMs: 60_000,
    maxAttempts: 5
  };

export function getWorkerRetryDelayMs(
  attempt: number,
  policy: WorkerRetryPolicy =
    DEFAULT_WORKER_RETRY_POLICY
): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error(
      "attempt must be a positive integer"
    );
  }

  return Math.min(
    policy.baseDelayMs * 2 ** (attempt - 1),
    policy.maxDelayMs
  );
}

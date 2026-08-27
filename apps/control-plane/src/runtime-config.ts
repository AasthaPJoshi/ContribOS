export interface RuntimeConfig {
  workerPollIntervalMs: number;
  reconciliationSweepIntervalMs: number;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0
  ) {
    throw new Error(
      `${name} must be a positive integer.`
    );
  }

  return parsed;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): RuntimeConfig {
  return {
    workerPollIntervalMs:
      positiveInteger(
        env["CONTRIBOS_WORKER_POLL_INTERVAL_MS"],
        1_000,
        "CONTRIBOS_WORKER_POLL_INTERVAL_MS"
      ),
    reconciliationSweepIntervalMs:
      positiveInteger(
        env["CONTRIBOS_RECONCILIATION_SWEEP_INTERVAL_MS"],
        300_000,
        "CONTRIBOS_RECONCILIATION_SWEEP_INTERVAL_MS"
      )
  };
}

export interface ServiceConfig {
  databaseUrl: string;
  githubAppId: string;
  githubPrivateKey: string;
  githubWebhookSecret: string;
  host: string;
  port: number;
  reconciliationSweepIntervalMs: number;
}

function required(
  env: NodeJS.ProcessEnv,
  name: string
): string {
  const value = env[name];

  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (!value?.trim()) {
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

export function loadServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): ServiceConfig {
  return {
    databaseUrl:
      required(env, "DATABASE_URL"),
    githubAppId:
      required(env, "GITHUB_APP_ID"),
    githubPrivateKey:
      required(env, "GITHUB_PRIVATE_KEY"),
    githubWebhookSecret:
      required(env, "GITHUB_WEBHOOK_SECRET"),
    host:
      env["CONTRIBOS_HOST"]?.trim() ||
      "0.0.0.0",
    port:
      positiveInteger(
        env["PORT"],
        3000,
        "PORT"
      ),
    reconciliationSweepIntervalMs:
      positiveInteger(
        env["CONTRIBOS_RECONCILIATION_SWEEP_INTERVAL_MS"],
        300_000,
        "CONTRIBOS_RECONCILIATION_SWEEP_INTERVAL_MS"
      )
  };
}

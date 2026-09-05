export interface ReadinessCheckResult {
  ready: boolean;
  reasonCode?: string;
}

export type ReadinessCheck =
  () => Promise<ReadinessCheckResult>;

export type ReadinessChecks =
  Record<string, ReadinessCheck>;

const DEFAULT_READINESS_TIMEOUT_MS =
  2_000;

async function runReadinessCheck(
  check: ReadinessCheck,
  timeoutMs: number
): Promise<ReadinessCheckResult> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      check(),
      new Promise<ReadinessCheckResult>(
        (resolve) => {
          timer = setTimeout(
            () => {
              resolve({
                ready: false,
                reasonCode:
                  "READINESS_CHECK_TIMEOUT"
              });
            },
            timeoutMs
          );
        }
      )
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function evaluateReadinessChecks(
  checks: ReadinessChecks,
  timeoutMs =
    DEFAULT_READINESS_TIMEOUT_MS
): Promise<Record<string, ReadinessCheckResult>> {
  const entries = await Promise.all(
    Object.entries(checks).map(
      async ([name, check]) => {
        try {
          return [
            name,
            await runReadinessCheck(
              check,
              timeoutMs
            )
          ] as const;
        } catch {
          return [
            name,
            {
              ready: false,
              reasonCode:
                "READINESS_CHECK_FAILED"
            }
          ] as const;
        }
      }
    )
  );

  return Object.fromEntries(entries);
}

export function readinessChecksPassed(
  checks: Record<string, ReadinessCheckResult>
): boolean {
  return Object.values(checks).every(
    (result) => result.ready
  );
}

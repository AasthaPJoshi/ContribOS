import { PersistenceError } from "@contribos/db";

export interface WorkerFailure {
  retryable: boolean;
  code: string;
  message: string;
}

export function classifyWorkerFailure(error: unknown): WorkerFailure {
  if (error instanceof PersistenceError) {
    return {
      retryable: error.retryable,
      code: error.code,
      message: error.message
    };
  }

  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : null;

  return {
    retryable: true,
    code:
      typeof record?.["code"] === "string"
        ? record["code"]
        : "WORKER_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "Unknown worker failure."
  };
}

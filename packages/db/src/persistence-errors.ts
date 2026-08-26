export type PersistenceErrorCode =
  | "CONFLICT"
  | "FOREIGN_KEY_VIOLATION"
  | "NOT_FOUND"
  | "STALE_CLAIM"
  | "TRANSIENT_DATABASE_ERROR"
  | "UNKNOWN_DATABASE_ERROR";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: PersistenceErrorCode,
    retryable: boolean
  ) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function classifyPersistenceError(
  error: unknown
): PersistenceError {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : null;

  const code =
    typeof record?.["code"] === "string"
      ? record["code"]
      : null;

  if (code === "23505") {
    return new PersistenceError(
      "Database uniqueness conflict.",
      "CONFLICT",
      false
    );
  }

  if (code === "23503") {
    return new PersistenceError(
      "Database foreign-key violation.",
      "FOREIGN_KEY_VIOLATION",
      false
    );
  }

  if (
    code === "40001" ||
    code === "40P01" ||
    code === "57P01" ||
    code === "53300"
  ) {
    return new PersistenceError(
      "Transient database failure.",
      "TRANSIENT_DATABASE_ERROR",
      true
    );
  }

  return new PersistenceError(
    "Unknown database failure.",
    "UNKNOWN_DATABASE_ERROR",
    false
  );
}

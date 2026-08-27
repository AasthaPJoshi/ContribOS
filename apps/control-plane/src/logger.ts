export interface LogRecord {
  level:
    | "info"
    | "warn"
    | "error";
  event: string;
  timestamp: string;
  fields?: Record<string, unknown>;
}

export interface RuntimeLogger {
  info(
    event: string,
    fields?: Record<string, unknown>
  ): void;

  warn(
    event: string,
    fields?: Record<string, unknown>
  ): void;

  error(
    event: string,
    fields?: Record<string, unknown>
  ): void;
}

export function createJsonLogger(
  write: (line: string) => void =
    console.log
): RuntimeLogger {
  const emit = (
    level: LogRecord["level"],
    event: string,
    fields?: Record<string, unknown>
  ) => {
    write(
      JSON.stringify({
        level,
        event,
        timestamp:
          new Date().toISOString(),
        ...(fields
          ? { fields }
          : {})
      } satisfies LogRecord)
    );
  };

  return {
    info: (event, fields) =>
      emit("info", event, fields),
    warn: (event, fields) =>
      emit("warn", event, fields),
    error: (event, fields) =>
      emit("error", event, fields)
  };
}

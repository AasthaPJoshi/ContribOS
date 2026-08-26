export function requireReturnedRow<T>(
  rows: T[],
  operation: string
): T {
  const row = rows[0];

  if (!row) {
    throw new Error(
      `Persistence operation did not return a row: ${operation}`
    );
  }

  return row;
}

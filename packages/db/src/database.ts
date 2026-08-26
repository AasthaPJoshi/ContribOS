import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export function createDatabase(pool: Pool) {
  return drizzle({
    client: pool,
    schema
  });
}

export type ContribOSDatabase =
  ReturnType<typeof createDatabase>;

export interface DatabaseHandle {
  db: ContribOSDatabase;
  pool: Pool;
  close(): Promise<void>;
}

export function createDatabaseHandle(
  connectionString: string
): DatabaseHandle {
  if (!connectionString.trim()) {
    throw new Error(
      "DATABASE_URL must be a non-empty PostgreSQL connection string."
    );
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });

  return {
    db: createDatabase(pool),
    pool,
    async close(): Promise<void> {
      await pool.end();
    }
  };
}

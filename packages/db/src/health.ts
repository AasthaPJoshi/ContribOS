import { sql } from "drizzle-orm";

import type {
  ContribOSDatabase
} from "./database.js";

export interface DatabaseReadinessResult {
  ready: boolean;
  reasonCode?: string;
}

export type DatabaseReadinessRunner =
  (database: ContribOSDatabase) => Promise<void>;

export async function checkDatabaseReady(
  database: ContribOSDatabase,
  runner: DatabaseReadinessRunner =
    async (target) => {
      await target.execute(sql`select 1`);
    }
): Promise<DatabaseReadinessResult> {
  try {
    await runner(database);
    return { ready: true };
  } catch {
    return {
      ready: false,
      reasonCode: "DATABASE_UNAVAILABLE"
    };
  }
}

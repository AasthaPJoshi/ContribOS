import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import type { ContribOSDatabase } from "./database.js";

export interface DatabaseMigrationOptions {
  migrationsFolder?: string;
  runner?: DatabaseMigrationRunner;
}

export type DatabaseMigrationRunner = (
  database: ContribOSDatabase,
  options: { migrationsFolder: string }
) => Promise<void>;

export function resolveMigrationsFolder(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../drizzle"
  );
}

export async function runDatabaseMigrations(
  database: ContribOSDatabase,
  options: DatabaseMigrationOptions = {}
): Promise<void> {
  const migrationsFolder =
    options.migrationsFolder ??
    resolveMigrationsFolder();

  if (
    !existsSync(migrationsFolder) ||
    !existsSync(
      join(
        migrationsFolder,
        "meta",
        "_journal.json"
      )
    )
  ) {
    throw new Error(
      `DATABASE_MIGRATIONS_NOT_FOUND:${migrationsFolder}`
    );
  }

  const runner: DatabaseMigrationRunner =
    options.runner ??
    (async (target, config) => {
      await migrate(target, config);
    });

  await runner(database, {
    migrationsFolder
  });
}

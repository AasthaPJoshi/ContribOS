import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function findSql(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findSql(path));
    } else if (entry.isFile() && entry.name.endsWith(".sql")) {
      files.push(path);
    }
  }

  return files.sort();
}

async function setup() {
  const pg = await PGlite.create();

  for (const file of await findSql(join(packageRoot, "drizzle"))) {
    await pg.exec(await readFile(file, "utf8"));
  }

  return pg;
}

describe("worker_jobs migration", () => {
  it("creates durable job storage", async () => {
    const pg = await setup();

    try {
      const result = await pg.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'worker_jobs';
      `);

      expect(result.rows).toHaveLength(1);
    } finally {
      await pg.close();
    }
  });

  it("enforces job deduplication keys", async () => {
    const pg = await setup();

    try {
      const sql = `
        INSERT INTO worker_jobs (
          id,
          type,
          payload,
          deduplication_key,
          max_attempts,
          available_at
        )
        VALUES (
          $1,
          'RECONCILE_PULL_REQUEST',
          '{}'::jsonb,
          'dedupe-1',
          5,
          NOW()
        );
      `;

      await pg.query(sql, [
        "11111111-1111-4111-8111-111111111111"
      ]);

      await expect(
        pg.query(sql, [
          "22222222-2222-4222-8222-222222222222"
        ])
      ).rejects.toThrow();
    } finally {
      await pg.close();
    }
  });
});

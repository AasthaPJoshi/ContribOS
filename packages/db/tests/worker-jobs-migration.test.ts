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

  it("blocks duplicate active jobs", async () => {
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
          'dedupe-active',
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

  it("allows the same deduplication key after completion", async () => {
    const pg = await setup();

    try {
      await pg.query(`
        INSERT INTO worker_jobs (
          id,
          type,
          payload,
          deduplication_key,
          max_attempts,
          available_at,
          status
        )
        VALUES (
          '33333333-3333-4333-8333-333333333333',
          'RECONCILE_PULL_REQUEST',
          '{}'::jsonb,
          'dedupe-completed',
          5,
          NOW(),
          'COMPLETED'
        );
      `);

      await pg.query(`
        INSERT INTO worker_jobs (
          id,
          type,
          payload,
          deduplication_key,
          max_attempts,
          available_at
        )
        VALUES (
          '44444444-4444-4444-8444-444444444444',
          'RECONCILE_PULL_REQUEST',
          '{}'::jsonb,
          'dedupe-completed',
          5,
          NOW()
        );
      `);

      const result = await pg.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM worker_jobs
        WHERE deduplication_key = 'dedupe-completed';
      `);

      expect(result.rows[0]?.count).toBe("2");
    } finally {
      await pg.close();
    }
  });

  it("allows the same deduplication key after a dead job", async () => {
    const pg = await setup();

    try {
      await pg.query(`
        INSERT INTO worker_jobs (
          id,
          type,
          payload,
          deduplication_key,
          max_attempts,
          available_at,
          status
        )
        VALUES (
          '55555555-5555-4555-8555-555555555555',
          'RECONCILE_PULL_REQUEST',
          '{}'::jsonb,
          'dedupe-dead',
          5,
          NOW(),
          'DEAD'
        );
      `);

      await pg.query(`
        INSERT INTO worker_jobs (
          id,
          type,
          payload,
          deduplication_key,
          max_attempts,
          available_at
        )
        VALUES (
          '66666666-6666-4666-8666-666666666666',
          'RECONCILE_PULL_REQUEST',
          '{}'::jsonb,
          'dedupe-dead',
          5,
          NOW()
        );
      `);

      const result = await pg.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count
        FROM worker_jobs
        WHERE deduplication_key = 'dedupe-dead';
      `);

      expect(result.rows[0]?.count).toBe("2");
    } finally {
      await pg.close();
    }
  });
});

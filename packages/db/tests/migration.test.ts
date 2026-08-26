import {
  readdir,
  readFile
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function findMigrationSqlFiles(
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true
  });

  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await findMigrationSqlFiles(path))
      );
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith(".sql")
    ) {
      files.push(path);
    }
  }

  return files.sort();
}

async function createMigratedDatabase() {
  const pg = await PGlite.create();

  const migrationFiles =
    await findMigrationSqlFiles(
      join(packageRoot, "drizzle")
    );

  expect(
    migrationFiles.length
  ).toBeGreaterThan(0);

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(
      migrationFile,
      "utf8"
    );

    await pg.exec(sql);
  }

  return pg;
}

describe("Phase 4 persistence migration", () => {
  it("creates all core ContribOS tables", async () => {
    const pg = await createMigratedDatabase();

    try {
      const result = await pg.query<{
        table_name: string;
      }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);

      const names = result.rows.map(
        (row) => row.table_name
      );

      expect(names).toEqual(
        expect.arrayContaining([
          "installations",
          "repositories",
          "contributions",
          "webhook_deliveries",
          "evidence",
          "state_evaluations",
          "reconciliation_runs",
          "state_history"
        ])
      );
    } finally {
      await pg.close();
    }
  });

  it("enforces atomic webhook delivery uniqueness", async () => {
    const pg = await createMigratedDatabase();

    try {
      await pg.query(
        `
        INSERT INTO webhook_deliveries (
          id,
          delivery_id,
          status
        )
        VALUES ($1, $2, $3);
        `,
        [
          "11111111-1111-4111-8111-111111111111",
          "delivery-123",
          "CLAIMED"
        ]
      );

      await expect(
        pg.query(
          `
          INSERT INTO webhook_deliveries (
            id,
            delivery_id,
            status
          )
          VALUES ($1, $2, $3);
          `,
          [
            "22222222-2222-4222-8222-222222222222",
            "delivery-123",
            "CLAIMED"
          ]
        )
      ).rejects.toThrow();
    } finally {
      await pg.close();
    }
  });

  it("enforces contribution identity within a repository", async () => {
    const pg = await createMigratedDatabase();

    try {
      const installationId =
        "11111111-1111-4111-8111-111111111111";
      const repositoryId =
        "22222222-2222-4222-8222-222222222222";

      await pg.query(
        `
        INSERT INTO installations (
          id,
          github_installation_id,
          permissions
        )
        VALUES ($1, $2, $3::jsonb);
        `,
        [
          installationId,
          "777",
          "{}"
        ]
      );

      await pg.query(
        `
        INSERT INTO repositories (
          id,
          installation_id,
          github_repository_id,
          owner,
          name,
          full_name,
          is_private
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7
        );
        `,
        [
          repositoryId,
          installationId,
          "1001",
          "example",
          "contribos",
          "example/contribos",
          false
        ]
      );

      await pg.query(
        `
        INSERT INTO contributions (
          id,
          repository_id,
          github_pull_request_id,
          pull_request_number,
          url,
          head_sha
        )
        VALUES (
          $1, $2, $3, $4, $5, $6
        );
        `,
        [
          "33333333-3333-4333-8333-333333333333",
          repositoryId,
          "9001",
          42,
          "https://github.com/example/contribos/pull/42",
          "abc123"
        ]
      );

      await expect(
        pg.query(
          `
          INSERT INTO contributions (
            id,
            repository_id,
            github_pull_request_id,
            pull_request_number,
            url,
            head_sha
          )
          VALUES (
            $1, $2, $3, $4, $5, $6
          );
          `,
          [
            "44444444-4444-4444-8444-444444444444",
            repositoryId,
            "9002",
            42,
            "https://github.com/example/contribos/pull/42",
            "def456"
          ]
        )
      ).rejects.toThrow();
    } finally {
      await pg.close();
    }
  });

  it("enforces foreign-key ownership boundaries", async () => {
    const pg = await createMigratedDatabase();

    try {
      await expect(
        pg.query(
          `
          INSERT INTO repositories (
            id,
            installation_id,
            github_repository_id,
            owner,
            name,
            full_name,
            is_private
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7
          );
          `,
          [
            "55555555-5555-4555-8555-555555555555",
            "66666666-6666-4666-8666-666666666666",
            "1001",
            "example",
            "contribos",
            "example/contribos",
            false
          ]
        )
      ).rejects.toThrow();
    } finally {
      await pg.close();
    }
  });
});

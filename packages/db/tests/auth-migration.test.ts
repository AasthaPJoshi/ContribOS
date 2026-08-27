import {
  readdir,
  readFile
} from "node:fs/promises";
import {
  dirname,
  join
} from "node:path";
import {
  fileURLToPath
} from "node:url";

import {
  PGlite
} from "@electric-sql/pglite";
import {
  describe,
  expect,
  it
} from "vitest";

const packageRoot = join(
  dirname(
    fileURLToPath(
      import.meta.url
    )
  ),
  ".."
);

async function migrationFiles():
  Promise<string[]> {
  const directory =
    join(
      packageRoot,
      "drizzle"
    );

  const entries =
    await readdir(
      directory,
      {
        withFileTypes: true
      }
    );

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(
          ".sql"
        )
    )
    .map(
      (entry) =>
        join(
          directory,
          entry.name
        )
    )
    .sort();
}

async function migratedDatabase() {
  const pg =
    await PGlite.create();

  for (
    const file of
    await migrationFiles()
  ) {
    await pg.exec(
      await readFile(
        file,
        "utf8"
      )
    );
  }

  return pg;
}

describe(
  "Phase 9 auth migration",
  () => {
    it("creates durable auth tables", async () => {
      const pg =
        await migratedDatabase();

      try {
        const result =
          await pg.query<{
            table_name: string;
          }>(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                'auth_users',
                'auth_sessions',
                'oauth_states'
              )
            ORDER BY table_name;
          `);

        expect(
          result.rows.map(
            (row) =>
              row.table_name
          )
        ).toEqual([
          "auth_sessions",
          "auth_users",
          "oauth_states"
        ]);
      } finally {
        await pg.close();
      }
    });

    it("enforces one provider identity per GitHub user", async () => {
      const pg =
        await migratedDatabase();

      try {
        await pg.query(
          `
          INSERT INTO auth_users (
            id,
            provider,
            provider_user_id,
            login,
            github_access_token_ciphertext
          )
          VALUES (
            $1, $2, $3, $4, $5
          );
          `,
          [
            "11111111-1111-4111-8111-111111111111",
            "GITHUB",
            "42",
            "octocat",
            "ciphertext-1"
          ]
        );

        await expect(
          pg.query(
            `
            INSERT INTO auth_users (
              id,
              provider,
              provider_user_id,
              login,
              github_access_token_ciphertext
            )
            VALUES (
              $1, $2, $3, $4, $5
            );
            `,
            [
              "22222222-2222-4222-8222-222222222222",
              "GITHUB",
              "42",
              "octocat-2",
              "ciphertext-2"
            ]
          )
        ).rejects.toThrow();
      } finally {
        await pg.close();
      }
    });

    it("enforces unique opaque session hashes", async () => {
      const pg =
        await migratedDatabase();

      try {
        const userId =
          "11111111-1111-4111-8111-111111111111";

        await pg.query(
          `
          INSERT INTO auth_users (
            id,
            provider,
            provider_user_id,
            login,
            github_access_token_ciphertext
          )
          VALUES (
            $1, $2, $3, $4, $5
          );
          `,
          [
            userId,
            "GITHUB",
            "42",
            "octocat",
            "ciphertext"
          ]
        );

        await pg.query(
          `
          INSERT INTO auth_sessions (
            id,
            user_id,
            token_hash,
            expires_at
          )
          VALUES (
            $1, $2, $3, $4
          );
          `,
          [
            "22222222-2222-4222-8222-222222222222",
            userId,
            "a".repeat(64),
            "2030-01-01T00:00:00Z"
          ]
        );

        await expect(
          pg.query(
            `
            INSERT INTO auth_sessions (
              id,
              user_id,
              token_hash,
              expires_at
            )
            VALUES (
              $1, $2, $3, $4
            );
            `,
            [
              "33333333-3333-4333-8333-333333333333",
              userId,
              "a".repeat(64),
              "2030-01-01T00:00:00Z"
            ]
          )
        ).rejects.toThrow();
      } finally {
        await pg.close();
      }
    });

    it("enforces unique OAuth state hashes", async () => {
      const pg =
        await migratedDatabase();

      try {
        await pg.query(
          `
          INSERT INTO oauth_states (
            id,
            state_hash,
            expires_at
          )
          VALUES (
            $1, $2, $3
          );
          `,
          [
            "11111111-1111-4111-8111-111111111111",
            "b".repeat(64),
            "2030-01-01T00:00:00Z"
          ]
        );

        await expect(
          pg.query(
            `
            INSERT INTO oauth_states (
              id,
              state_hash,
              expires_at
            )
            VALUES (
              $1, $2, $3
            );
            `,
            [
              "22222222-2222-4222-8222-222222222222",
              "b".repeat(64),
              "2030-01-01T00:00:00Z"
            ]
          )
        ).rejects.toThrow();
      } finally {
        await pg.close();
      }
    });
  }
);

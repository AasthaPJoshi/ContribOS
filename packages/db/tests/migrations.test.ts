import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  resolveMigrationsFolder,
  runDatabaseMigrations
} from "../src/migrations.js";

describe("startup database migrations", () => {
  it("runs the checked-in Drizzle migration journal", async () => {
    const runner = vi.fn(async () => {});

    await runDatabaseMigrations(
      {} as never,
      { runner }
    );

    expect(runner).toHaveBeenCalledWith(
      expect.anything(),
      {
        migrationsFolder:
          resolveMigrationsFolder()
      }
    );
  });

  it("fails closed when migration assets are missing", async () => {
    await expect(
      runDatabaseMigrations(
        {} as never,
        {
          migrationsFolder:
            "/definitely/missing/contribos-migrations",
          runner: vi.fn(async () => {})
        }
      )
    ).rejects.toThrow(
      "DATABASE_MIGRATIONS_NOT_FOUND"
    );
  });
});

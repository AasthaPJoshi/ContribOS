import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  checkDatabaseReady
} from "../src/health.js";
import type {
  ContribOSDatabase
} from "../src/database.js";

const database = {} as ContribOSDatabase;

describe("database readiness", () => {
  it("reports ready after a successful probe", async () => {
    const runner = vi.fn(async () => undefined);

    await expect(
      checkDatabaseReady(database, runner)
    ).resolves.toEqual({ ready: true });

    expect(runner).toHaveBeenCalledWith(database);
  });

  it("returns a sanitized failure reason", async () => {
    const runner = vi.fn(async () => {
      throw new Error("connection secret");
    });

    await expect(
      checkDatabaseReady(database, runner)
    ).resolves.toEqual({
      ready: false,
      reasonCode: "DATABASE_UNAVAILABLE"
    });
  });
});

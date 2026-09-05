import {
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
  describe,
  expect,
  it
} from "vitest";

const here = dirname(
  fileURLToPath(import.meta.url)
);

describe("service startup ordering", () => {
  it("applies database migrations before accepting traffic", async () => {
    const source = await readFile(
      join(
        here,
        "../src/service-entrypoint.ts"
      ),
      "utf8"
    );

    const migrationIndex =
      source.indexOf(
        "await runDatabaseMigrations("
      );
    const listenIndex =
      source.indexOf(
        "server.listen("
      );

    expect(migrationIndex)
      .toBeGreaterThanOrEqual(0);
    expect(listenIndex)
      .toBeGreaterThanOrEqual(0);
    expect(migrationIndex)
      .toBeLessThan(listenIndex);
  });
});

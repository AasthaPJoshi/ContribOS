import {
  readFile,
  readdir
} from "node:fs/promises";
import {
  dirname,
  join
} from "node:path";
import {
  fileURLToPath
} from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  describe,
  expect,
  it
} from "vitest";

import * as schema from "../src/schema.js";
import {
  WebhookDeliveryRepository
} from "../src/repositories/webhook-delivery-repository.js";

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function findSql(
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findSql(path));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".sql")
    ) {
      files.push(path);
    }
  }

  return files.sort();
}

async function setup() {
  const client = await PGlite.create();

  for (
    const file of await findSql(
      join(packageRoot, "drizzle")
    )
  ) {
    await client.exec(
      await readFile(file, "utf8")
    );
  }

  return {
    client,
    db: drizzle(client, { schema })
  };
}

describe("WebhookDeliveryRepository lifecycle", () => {
  it("claims only once and distinguishes processed state", async () => {
    const { client, db } = await setup();

    try {
      const repository =
        new WebhookDeliveryRepository(
          db as any
        );

      expect(
        await repository.tryClaim(
          "delivery-1"
        )
      ).toBe(true);

      expect(
        await repository.tryClaim(
          "delivery-1"
        )
      ).toBe(false);

      expect(
        await repository.hasProcessed(
          "delivery-1"
        )
      ).toBe(false);

      await repository.markProcessed(
        "delivery-1"
      );

      expect(
        await repository.hasProcessed(
          "delivery-1"
        )
      ).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("marks stale claims as failed", async () => {
    const { client, db } = await setup();

    try {
      const repository =
        new WebhookDeliveryRepository(
          db as any
        );

      await repository.tryClaim(
        "delivery-stale"
      );

      const recovered =
        await repository.recoverStaleClaims({
          staleBefore: new Date(
            Date.now() + 60_000
          )
        });

      expect(recovered).toHaveLength(1);
      expect(recovered[0]?.status).toBe(
        "FAILED"
      );
      expect(recovered[0]?.errorCode).toBe(
        "STALE_CLAIM"
      );
    } finally {
      await client.close();
    }
  });
});

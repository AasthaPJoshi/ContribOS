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
  persistReconciliationTransaction
} from "../src/persist-reconciliation.js";

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

  const installationId =
    "11111111-1111-4111-8111-111111111111";
  const repositoryId =
    "22222222-2222-4222-8222-222222222222";

  await client.query(
    `
      INSERT INTO installations (
        id,
        github_installation_id,
        permissions
      ) VALUES ($1, $2, $3::jsonb)
    `,
    [installationId, "10", "{}"]
  );

  await client.query(
    `
      INSERT INTO repositories (
        id,
        installation_id,
        github_repository_id,
        owner,
        name,
        full_name,
        is_private
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
    `,
    [
      repositoryId,
      installationId,
      "20",
      "example",
      "repo",
      "example/repo",
      false
    ]
  );

  return {
    client,
    repositoryId,
    db: drizzle(client, { schema })
  };
}

function reconciliation(
  at: Date
) {
  return {
    status: "STABLE",
    reasonCode: "STABLE",
    headSha: "abc123",
    reconciledAt: at,
    record: {
      pullRequestId: "9001",
      url:
        "https://github.com/example/repo/pull/42",
      headSha: "abc123"
    },
    snapshot: {
      evidence: [],
      isDraft: false,
      isOpen: true,
      isMerged: false,
      hasMergeConflict: false,
      checkStatus: "SUCCESS",
      reviewDecision: "APPROVED",
      authorHasChangesToMake: false,
      maintainerReviewRequired: false
    },
    evidence: [],
    repairDecision: {
      action: "NONE"
    },
    drift: null
  } as any;
}

function evaluation(
  workflowState: string,
  at: Date
) {
  return {
    workflowState,
    nextActor: "MAINTAINER",
    readiness: "READY_TO_MERGE",
    reasonCode: workflowState,
    explanation: workflowState,
    engineVersion: "test",
    evaluatedAt: at,
    evidence: []
  } as any;
}

describe("atomic reconciliation persistence", () => {
  it("rolls back the contribution upsert when a later write fails", async () => {
    const {
      client,
      db,
      repositoryId
    } = await setup();

    try {
      await client.exec(`
        ALTER TABLE state_evaluations
        ADD CONSTRAINT reject_failure_test
        CHECK (workflow_state <> 'FAIL_TEST');
      `);

      const at = new Date(
        "2026-09-02T00:00:00Z"
      );

      await expect(
        persistReconciliationTransaction(
          db as any,
          {
            repositoryId,
            pullRequestNumber: 42,
            reconciliation:
              reconciliation(at),
            evaluation:
              evaluation(
                "FAIL_TEST",
                at
              ),
            startedAt: at,
            completedAt: at
          }
        )
      ).rejects.toThrow();

      const rows = await client.query<{
        count: string;
      }>(
        "SELECT COUNT(*)::text AS count FROM contributions"
      );

      expect(
        Number(rows.rows[0]?.count)
      ).toBe(0);
    } finally {
      await client.close();
    }
  }, 15_000);

  it("records history only when deterministic workflow state changes", async () => {
    const {
      client,
      db,
      repositoryId
    } = await setup();

    try {
      const firstAt = new Date(
        "2026-09-02T00:00:00Z"
      );
      const secondAt = new Date(
        "2026-09-02T00:01:00Z"
      );
      const thirdAt = new Date(
        "2026-09-02T00:02:00Z"
      );

      await persistReconciliationTransaction(
        db as any,
        {
          repositoryId,
          pullRequestNumber: 42,
          reconciliation:
            reconciliation(firstAt),
          evaluation:
            evaluation(
              "IN_REVIEW",
              firstAt
            ),
          startedAt: firstAt,
          completedAt: firstAt
        }
      );

      await persistReconciliationTransaction(
        db as any,
        {
          repositoryId,
          pullRequestNumber: 42,
          reconciliation:
            reconciliation(secondAt),
          evaluation:
            evaluation(
              "READY_TO_MERGE",
              secondAt
            ),
          startedAt: secondAt,
          completedAt: secondAt
        }
      );

      await persistReconciliationTransaction(
        db as any,
        {
          repositoryId,
          pullRequestNumber: 42,
          reconciliation:
            reconciliation(thirdAt),
          evaluation:
            evaluation(
              "READY_TO_MERGE",
              thirdAt
            ),
          startedAt: thirdAt,
          completedAt: thirdAt
        }
      );

      const history = await client.query<{
        from_state: string | null;
        to_state: string;
      }>(`
        SELECT from_state, to_state
        FROM state_history
        ORDER BY changed_at ASC
      `);

      expect(history.rows).toEqual([
        {
          from_state: null,
          to_state: "IN_REVIEW"
        },
        {
          from_state: "IN_REVIEW",
          to_state: "READY_TO_MERGE"
        }
      ]);
    } finally {
      await client.close();
    }
  }, 15_000);
});

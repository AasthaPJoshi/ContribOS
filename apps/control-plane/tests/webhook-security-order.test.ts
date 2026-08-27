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

const here =
  dirname(
    fileURLToPath(
      import.meta.url
    )
  );

describe(
  "webhook security ordering",
  () => {
    it("keeps signature verification before any JSON parsing in the ingestion boundary", async () => {
      const source =
        await readFile(
          join(
            here,
            "../../../packages/github/src/ingest-webhook.ts"
          ),
          "utf8"
        );

      const verifyIndex =
        source.indexOf(
          "verifyGitHubWebhookSignature"
        );

      const parseIndex =
        source.indexOf(
          "JSON.parse"
        );

      expect(
        verifyIndex
      ).toBeGreaterThanOrEqual(0);

      if (
        parseIndex >= 0
      ) {
        expect(
          verifyIndex
        ).toBeLessThan(
          parseIndex
        );
      }
    });
  }
);

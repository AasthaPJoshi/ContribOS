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

describe("webhook security ordering", () => {
  it("verifies the signature before JSON parsing at the HTTP service boundary", async () => {
    const source = await readFile(
      join(
        here,
        "../src/github-webhook-service.ts"
      ),
      "utf8"
    );

    const verifyIndex = source.indexOf(
      "verifyGitHubWebhookSignature("
    );
    const parseIndex = source.indexOf(
      "JSON.parse("
    );

    expect(verifyIndex)
      .toBeGreaterThanOrEqual(0);
    expect(parseIndex)
      .toBeGreaterThanOrEqual(0);
    expect(verifyIndex)
      .toBeLessThan(parseIndex);
  });
});

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyGitHubWebhookSignature } from "../src/verify-webhook-signature.js";

describe("verifyGitHubWebhookSignature", () => {
  it("accepts a valid GitHub webhook signature", () => {
    const rawBody = '{"action":"opened"}';
    const secret = "test-secret";

    const signature =
      "sha256=" +
      createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("hex");

    expect(
      verifyGitHubWebhookSignature(rawBody, signature, secret)
    ).toBe(true);
  });

  it("rejects an invalid GitHub webhook signature", () => {
    expect(
      verifyGitHubWebhookSignature(
        '{"action":"opened"}',
        "sha256=invalid",
        "test-secret"
      )
    ).toBe(false);
  });

  it("rejects a missing GitHub webhook signature", () => {
    expect(
      verifyGitHubWebhookSignature(
        '{"action":"opened"}',
        undefined,
        "test-secret"
      )
    ).toBe(false);
  });
});

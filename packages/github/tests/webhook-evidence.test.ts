import { describe, expect, it } from "vitest";

import { createWebhookEvidence } from "../src/webhook-evidence.js";

describe("createWebhookEvidence", () => {
  it("creates evidence from a normalized GitHub event", () => {
    const occurredAt = new Date("2026-08-25T00:59:00.000Z");

    const evidence = createWebhookEvidence({
      deliveryId: "delivery-pr",
      eventName: "pull_request",
      action: "opened",
      installationId: 1001,
      repositoryId: 2002,
      objectType: "PULL_REQUEST",
      objectId: "456",
      objectUrl: "https://github.com/example/repo/pull/42",
      contributionNumber: 42,
      headSha: "abc123",
      occurredAt
    });

    expect(evidence).toEqual({
      id: "github:pull-request:456",
      source: "GITHUB",
      objectType: "PULL_REQUEST",
      externalId: "456",
      url: "https://github.com/example/repo/pull/42",
      occurredAt
    });
  });
});

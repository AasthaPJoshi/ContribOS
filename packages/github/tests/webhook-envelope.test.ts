import { describe, expect, it } from "vitest";

import type { GitHubWebhookEnvelope } from "../src/webhook-envelope.js";

describe("GitHubWebhookEnvelope", () => {
  it("captures delivery and repository context for a webhook", () => {
    const envelope: GitHubWebhookEnvelope<{ action: string }> = {
      deliveryId: "delivery-123",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T00:00:00.000Z"),
      payload: {
        action: "opened"
      }
    };

    expect(envelope.deliveryId).toBe("delivery-123");
    expect(envelope.eventName).toBe("pull_request");
    expect(envelope.installationId).toBe(1001);
    expect(envelope.repositoryId).toBe(2002);
    expect(envelope.payload.action).toBe("opened");
  });
});

import { describe, expect, it } from "vitest";

import {
  InMemoryWebhookDeliveryStore,
  processWebhook,
  type GitHubWebhookEnvelope
} from "../src/index.js";

describe("processWebhook", () => {
  it("accepts a webhook delivery the first time it is processed", async () => {
    const store = new InMemoryWebhookDeliveryStore();

    const envelope: GitHubWebhookEnvelope = {
      deliveryId: "delivery-123",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T00:00:00.000Z"),
      payload: {}
    };

    const result = await processWebhook(envelope, store);

    expect(result).toEqual({
      status: "ACCEPTED",
      deliveryId: "delivery-123",
      reasonCode: "DELIVERY_ACCEPTED"
    });
  });

  it("rejects a webhook delivery that was already processed", async () => {
    const store = new InMemoryWebhookDeliveryStore();

    const envelope: GitHubWebhookEnvelope = {
      deliveryId: "delivery-123",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T00:00:00.000Z"),
      payload: {}
    };

    await processWebhook(envelope, store);
    const duplicateResult = await processWebhook(envelope, store);

    expect(duplicateResult).toEqual({
      status: "DUPLICATE",
      deliveryId: "delivery-123",
      reasonCode: "DELIVERY_ALREADY_PROCESSED"
    });
  });
});

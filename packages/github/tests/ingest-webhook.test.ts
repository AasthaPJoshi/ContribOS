import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  InMemoryWebhookDeliveryStore,
  ingestWebhook,
  type GitHubWebhookEnvelope
} from "../src/index.js";

describe("ingestWebhook", () => {
  it("accepts a valid signed webhook", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const rawBody = '{"action":"opened"}';
    const webhookSecret = "test-secret";

    const signatureHeader =
      "sha256=" +
      createHmac("sha256", webhookSecret)
        .update(rawBody, "utf8")
        .digest("hex");

    const envelope: GitHubWebhookEnvelope = {
      deliveryId: "delivery-123",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T00:00:00.000Z"),
      payload: {
        action: "opened"
      }
    };

    const result = await ingestWebhook(
      {
        rawBody,
        signatureHeader,
        webhookSecret,
        envelope
      },
      store
    );

    expect(result).toEqual({
      status: "ACCEPTED",
      deliveryId: "delivery-123",
      reasonCode: "DELIVERY_ACCEPTED"
    });
  });

  it("rejects an invalid signature before processing the delivery", async () => {
    const store = new InMemoryWebhookDeliveryStore();

    const envelope: GitHubWebhookEnvelope = {
      deliveryId: "delivery-123",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T00:00:00.000Z"),
      payload: {}
    };

    const result = await ingestWebhook(
      {
        rawBody: '{"action":"opened"}',
        signatureHeader: "sha256=invalid",
        webhookSecret: "test-secret",
        envelope
      },
      store
    );

    expect(result).toEqual({
      status: "REJECTED",
      deliveryId: "delivery-123",
      reasonCode: "INVALID_SIGNATURE"
    });

    expect(await store.hasProcessed("delivery-123")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  InMemoryWebhookDeliveryStore,
  processWebhook,
  type GitHubWebhookEnvelope
} from "../src/index.js";

function validEnvelope(
  overrides: Partial<GitHubWebhookEnvelope> = {}
): GitHubWebhookEnvelope {
  return {
    deliveryId: "delivery-123",
    eventName: "pull_request",
    installationId: 1001,
    repositoryId: 2002,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {
      action: "opened"
    },
    ...overrides
  };
}

describe("processWebhook", () => {
  it("accepts a webhook delivery the first time it is processed", async () => {
    const store = new InMemoryWebhookDeliveryStore();

    const result = await processWebhook(validEnvelope(), store);

    expect(result).toEqual({
      status: "ACCEPTED",
      deliveryId: "delivery-123",
      reasonCode: "DELIVERY_ACCEPTED"
    });
  });

  it("rejects a webhook delivery that was already processed", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const envelope = validEnvelope();

    await processWebhook(envelope, store);
    const duplicateResult = await processWebhook(envelope, store);

    expect(duplicateResult).toEqual({
      status: "DUPLICATE",
      deliveryId: "delivery-123",
      reasonCode: "DELIVERY_ALREADY_PROCESSED"
    });
  });

  it("allows only one concurrent claim for the same delivery", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const envelope = validEnvelope();

    const results = await Promise.all([
      processWebhook(envelope, store),
      processWebhook(envelope, store)
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "ACCEPTED",
      "DUPLICATE"
    ]);
  });

  it("rejects a webhook with a missing delivery ID", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ deliveryId: "   " }),
      store
    );
    expect(result.reasonCode).toBe("MISSING_DELIVERY_ID");
  });

  it("rejects a webhook with a missing event name", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ eventName: "   " }),
      store
    );
    expect(result.reasonCode).toBe("MISSING_EVENT_NAME");
  });

  it("rejects a webhook with a missing installation ID", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ installationId: null }),
      store
    );
    expect(result.reasonCode).toBe("MISSING_INSTALLATION_ID");
  });

  it("rejects a webhook with a missing repository ID", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ repositoryId: null }),
      store
    );
    expect(result.reasonCode).toBe("MISSING_REPOSITORY_ID");
  });

  it("rejects an unsupported GitHub webhook event", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ eventName: "issues" }),
      store
    );
    expect(result.reasonCode).toBe("UNSUPPORTED_EVENT");
  });

  it("rejects a webhook with a missing event action", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ payload: {} }),
      store
    );
    expect(result.reasonCode).toBe("MISSING_EVENT_ACTION");
  });

  it("rejects an unsupported webhook action", async () => {
    const store = new InMemoryWebhookDeliveryStore();
    const result = await processWebhook(
      validEnvelope({ payload: { action: "labeled" } }),
      store
    );
    expect(result.reasonCode).toBe("UNSUPPORTED_EVENT_ACTION");
  });
});

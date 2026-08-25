import { describe, expect, it } from "vitest";

import { InMemoryWebhookDeliveryStore } from "../src/in-memory-webhook-delivery-store.js";

describe("InMemoryWebhookDeliveryStore", () => {
  it("tracks whether a webhook delivery has already been processed", async () => {
    const store = new InMemoryWebhookDeliveryStore();

    expect(await store.hasProcessed("delivery-123")).toBe(false);

    await store.markProcessed("delivery-123");

    expect(await store.hasProcessed("delivery-123")).toBe(true);
  });

  it("keeps different delivery IDs independent", async () => {
    const store = new InMemoryWebhookDeliveryStore();

    await store.markProcessed("delivery-123");

    expect(await store.hasProcessed("delivery-123")).toBe(true);
    expect(await store.hasProcessed("delivery-456")).toBe(false);
  });
});

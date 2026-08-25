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
      payload: {
        action: "opened"
      }
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
      payload: {
        action: "opened"
      }
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

it("rejects a webhook with a missing delivery ID", async () => {
  const store = new InMemoryWebhookDeliveryStore();

  const envelope: GitHubWebhookEnvelope = {
    deliveryId: "   ",
    eventName: "pull_request",
    installationId: 1001,
    repositoryId: 2002,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {}
  };

  const result = await processWebhook(envelope, store);

  expect(result).toEqual({
    status: "REJECTED",
    deliveryId: "   ",
    reasonCode: "MISSING_DELIVERY_ID"
  });
});

it("rejects a webhook with a missing event name", async () => {
  const store = new InMemoryWebhookDeliveryStore();

  const envelope: GitHubWebhookEnvelope = {
    deliveryId: "delivery-123",
    eventName: "   ",
    installationId: 1001,
    repositoryId: 2002,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {}
  };

  const result = await processWebhook(envelope, store);

  expect(result).toEqual({
    status: "REJECTED",
    deliveryId: "delivery-123",
    reasonCode: "MISSING_EVENT_NAME"
  });
});

it("rejects a webhook with a missing installation ID", async () => {
  const store = new InMemoryWebhookDeliveryStore();

  const envelope: GitHubWebhookEnvelope = {
    deliveryId: "delivery-123",
    eventName: "pull_request",
    installationId: null,
    repositoryId: 2002,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {
      action: "opened"
    }
  };

  const result = await processWebhook(envelope, store);

  expect(result).toEqual({
    status: "REJECTED",
    deliveryId: "delivery-123",
    reasonCode: "MISSING_INSTALLATION_ID"
  });
});

it("rejects a webhook with a missing repository ID", async () => {
  const store = new InMemoryWebhookDeliveryStore();

  const envelope: GitHubWebhookEnvelope = {
    deliveryId: "delivery-123",
    eventName: "pull_request",
    installationId: 1001,
    repositoryId: null,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {
      action: "opened"
    }
  };

  const result = await processWebhook(envelope, store);

  expect(result).toEqual({
    status: "REJECTED",
    deliveryId: "delivery-123",
    reasonCode: "MISSING_REPOSITORY_ID"
  });
});

it("rejects an unsupported GitHub webhook event", async () => {
  const store = new InMemoryWebhookDeliveryStore();

  const envelope: GitHubWebhookEnvelope = {
    deliveryId: "delivery-123",
    eventName: "issues",
    installationId: 1001,
    repositoryId: 2002,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {}
  };

  const result = await processWebhook(envelope, store);

  expect(result).toEqual({
    status: "REJECTED",
    deliveryId: "delivery-123",
    reasonCode: "UNSUPPORTED_EVENT"
  });
});

it("rejects a webhook with a missing event action", async () => {
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
    status: "REJECTED",
    deliveryId: "delivery-123",
    reasonCode: "MISSING_EVENT_ACTION"
  });
});

it("rejects an unsupported webhook action", async () => {
  const store = new InMemoryWebhookDeliveryStore();

  const envelope: GitHubWebhookEnvelope = {
    deliveryId: "delivery-123",
    eventName: "pull_request",
    installationId: 1001,
    repositoryId: 2002,
    receivedAt: new Date("2026-08-25T00:00:00.000Z"),
    payload: {
      action: "labeled"
    }
  };

  const result = await processWebhook(envelope, store);

  expect(result).toEqual({
    status: "REJECTED",
    deliveryId: "delivery-123",
    reasonCode: "UNSUPPORTED_EVENT_ACTION"
  });
});

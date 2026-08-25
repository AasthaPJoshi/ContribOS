import { isSupportedGitHubWebhookAction } from "./supported-webhook-actions.js";
import { isSupportedGitHubWebhookEvent } from "./supported-webhook-events.js";

import type { GitHubWebhookEnvelope } from "./webhook-envelope.js";
import type { WebhookDeliveryStore } from "./webhook-delivery-store.js";
import type { WebhookProcessingResult } from "./webhook-processing-result.js";

export async function processWebhook(
  envelope: GitHubWebhookEnvelope,
  deliveryStore: WebhookDeliveryStore
): Promise<WebhookProcessingResult> {
  if (!envelope.deliveryId.trim()) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "MISSING_DELIVERY_ID"
    };
  }

  if (!envelope.eventName.trim()) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "MISSING_EVENT_NAME"
    };
  }

  if (!isSupportedGitHubWebhookEvent(envelope.eventName)) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "UNSUPPORTED_EVENT"
    };
  }

  const action =
    typeof envelope.payload === "object" &&
    envelope.payload !== null &&
    "action" in envelope.payload &&
    typeof envelope.payload.action === "string"
      ? envelope.payload.action
      : "";

  if (!action.trim()) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "MISSING_EVENT_ACTION"
    };
  }

  if (!isSupportedGitHubWebhookAction(envelope.eventName, action)) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "UNSUPPORTED_EVENT_ACTION"
    };
  }

  if (envelope.installationId === null) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "MISSING_INSTALLATION_ID"
    };
  }

  if (envelope.repositoryId === null) {
    return {
      status: "REJECTED",
      deliveryId: envelope.deliveryId,
      reasonCode: "MISSING_REPOSITORY_ID"
    };
  }

  if (await deliveryStore.hasProcessed(envelope.deliveryId)) {
    return {
      status: "DUPLICATE",
      deliveryId: envelope.deliveryId,
      reasonCode: "DELIVERY_ALREADY_PROCESSED"
    };
  }

  await deliveryStore.markProcessed(envelope.deliveryId);

  return {
    status: "ACCEPTED",
    deliveryId: envelope.deliveryId,
    reasonCode: "DELIVERY_ACCEPTED"
  };
}

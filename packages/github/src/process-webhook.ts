import { isSupportedGitHubWebhookAction } from "./supported-webhook-actions.js";
import { isSupportedGitHubWebhookEvent } from "./supported-webhook-events.js";
import { getGitHubWebhookAction } from "./webhook-payload.js";

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

  const action = getGitHubWebhookAction(envelope.payload);

  if (!action) {
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

  const claimed = await deliveryStore.tryClaim(envelope.deliveryId);

  if (!claimed) {
    return {
      status: "DUPLICATE",
      deliveryId: envelope.deliveryId,
      reasonCode: "DELIVERY_ALREADY_PROCESSED"
    };
  }

  return {
    status: "ACCEPTED",
    deliveryId: envelope.deliveryId,
    reasonCode: "DELIVERY_ACCEPTED"
  };
}

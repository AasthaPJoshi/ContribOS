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

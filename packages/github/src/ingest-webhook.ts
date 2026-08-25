import { processWebhook } from "./process-webhook.js";
import { verifyGitHubWebhookSignature } from "./verify-webhook-signature.js";

import type { GitHubWebhookEnvelope } from "./webhook-envelope.js";
import type { WebhookDeliveryStore } from "./webhook-delivery-store.js";
import type { WebhookProcessingResult } from "./webhook-processing-result.js";

export interface IngestWebhookInput {
  rawBody: string;
  signatureHeader: string | undefined;
  webhookSecret: string;
  envelope: GitHubWebhookEnvelope;
}

export async function ingestWebhook(
  input: IngestWebhookInput,
  deliveryStore: WebhookDeliveryStore
): Promise<WebhookProcessingResult> {
  const isValidSignature = verifyGitHubWebhookSignature(
    input.rawBody,
    input.signatureHeader,
    input.webhookSecret
  );

  if (!isValidSignature) {
    return {
      status: "REJECTED",
      deliveryId: input.envelope.deliveryId,
      reasonCode: "INVALID_SIGNATURE"
    };
  }

  return processWebhook(input.envelope, deliveryStore);
}

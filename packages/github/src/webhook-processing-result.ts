export type WebhookProcessingStatus =
  | "ACCEPTED"
  | "DUPLICATE"
  | "REJECTED";

export interface WebhookProcessingResult {
  status: WebhookProcessingStatus;
  deliveryId: string;
  reasonCode: string;
}

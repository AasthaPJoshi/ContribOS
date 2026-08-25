export interface WebhookDeliveryStore {
  hasProcessed(deliveryId: string): Promise<boolean>;
  markProcessed(deliveryId: string): Promise<void>;
}

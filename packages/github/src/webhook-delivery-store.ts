export interface WebhookDeliveryStore {
  hasProcessed(deliveryId: string): Promise<boolean>;
  markProcessed(deliveryId: string): Promise<void>;

  /**
   * Atomically claims a delivery ID.
   * Returns true only for the first successful claim.
   */
  tryClaim(deliveryId: string): Promise<boolean>;
}

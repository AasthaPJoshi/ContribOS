import type { WebhookDeliveryStore } from "./webhook-delivery-store.js";

export class InMemoryWebhookDeliveryStore implements WebhookDeliveryStore {
  private readonly processed = new Set<string>();

  async hasProcessed(deliveryId: string): Promise<boolean> {
    return this.processed.has(deliveryId);
  }

  async markProcessed(deliveryId: string): Promise<void> {
    this.processed.add(deliveryId);
  }

  async tryClaim(deliveryId: string): Promise<boolean> {
    if (this.processed.has(deliveryId)) {
      return false;
    }

    this.processed.add(deliveryId);
    return true;
  }
}

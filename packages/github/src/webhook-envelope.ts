export interface GitHubWebhookEnvelope<TPayload = unknown> {
  deliveryId: string;
  eventName: string;

  installationId: number | null;
  repositoryId: number | null;

  receivedAt: Date;
  payload: TPayload;
}

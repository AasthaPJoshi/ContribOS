import type { EvidenceObjectType } from "@contribos/domain";

import type { SupportedGitHubWebhookEvent } from "./supported-webhook-events.js";

export interface NormalizedGitHubWebhookEvent {
  deliveryId: string;
  eventName: SupportedGitHubWebhookEvent;
  action: string;

  installationId: number;
  repositoryId: number;

  objectType: EvidenceObjectType;
  objectId: string;
  objectUrl: string;

  contributionNumber: number | null;
  headSha: string | null;

  occurredAt: Date;
}

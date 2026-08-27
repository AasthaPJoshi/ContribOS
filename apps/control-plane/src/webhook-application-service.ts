import type {
  NormalizedGitHubWebhookEvent
} from "@contribos/github";
import {
  enqueueFromWebhook,
  type JobStore
} from "@contribos/worker";

export type WebhookEnqueueResult =
  | "ENQUEUED"
  | "IGNORED"
  | "DUPLICATE";

export class WebhookApplicationService {
  constructor(
    private readonly store: JobStore
  ) {}

  async acceptNormalizedEvent(
    event: NormalizedGitHubWebhookEvent
  ): Promise<WebhookEnqueueResult> {
    if (
      event.contributionNumber === null
    ) {
      return "IGNORED";
    }

    const enqueued =
      await enqueueFromWebhook(
        this.store,
        event
      );

    return enqueued
      ? "ENQUEUED"
      : "DUPLICATE";
  }
}

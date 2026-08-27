import type {
  NormalizedGitHubWebhookEvent
} from "@contribos/github";

import type {
  JobStore
} from "./job-store.js";
import {
  enqueueReconcilePullRequest
} from "./enqueue.js";

export async function enqueueFromWebhook(
  store: JobStore,
  event: NormalizedGitHubWebhookEvent
): Promise<boolean> {
  if (
    event.contributionNumber === null
  ) {
    return false;
  }

  return enqueueReconcilePullRequest(
    store,
    {
      installationId:
        event.installationId,
      repositoryId:
        event.repositoryId,
      pullRequestNumber:
        event.contributionNumber
    }
  );
}

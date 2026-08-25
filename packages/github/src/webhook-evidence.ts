import type { EvidenceRef } from "@contribos/domain";

import type { NormalizedGitHubWebhookEvent } from "./normalized-webhook-event.js";

const OBJECT_TYPE_SLUG = {
  PULL_REQUEST: "pull-request",
  ISSUE: "issue",
  REVIEW: "review",
  REVIEW_THREAD: "review-thread",
  CHECK_RUN: "check-run",
  CHECK_SUITE: "check-suite",
  WORKFLOW_RUN: "workflow-run",
  COMMIT: "commit",
  RELEASE: "release",
  REPOSITORY: "repository"
} as const;

export function createWebhookEvidence(
  event: NormalizedGitHubWebhookEvent
): EvidenceRef {
  return {
    id: `github:${OBJECT_TYPE_SLUG[event.objectType]}:${event.objectId}`,
    source: "GITHUB",
    objectType: event.objectType,
    externalId: event.objectId,
    url: event.objectUrl,
    occurredAt: event.occurredAt
  };
}

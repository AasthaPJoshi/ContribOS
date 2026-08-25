import type { EvidenceRef } from "@contribos/domain";

import type { GitHubPullRequestRecord } from "./pull-request-record.js";

export function createPullRequestEvidence(
  record: GitHubPullRequestRecord,
  occurredAt: Date
): EvidenceRef {
  return {
    id: `github:pull-request:${record.pullRequestId}`,
    source: "GITHUB",
    objectType: "PULL_REQUEST",
    externalId: record.pullRequestId,
    url: record.url,
    occurredAt
  };
}

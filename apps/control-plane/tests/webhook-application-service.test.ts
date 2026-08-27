import {
  describe,
  expect,
  it
} from "vitest";

import type {
  NormalizedGitHubWebhookEvent
} from "@contribos/github";
import {
  InMemoryJobStore
} from "@contribos/worker";

import {
  WebhookApplicationService
} from "../src/webhook-application-service.js";

function event(
  contributionNumber:
    number | null
): NormalizedGitHubWebhookEvent {
  return {
    deliveryId: "delivery-1",
    eventName: "pull_request",
    action: "synchronize",
    installationId: 10,
    repositoryId: 20,
    objectType:
      "PULL_REQUEST",
    objectId: "100",
    objectUrl:
      "https://example.test/pr/42",
    contributionNumber,
    headSha: "abc123",
    occurredAt:
      new Date(
        "2026-08-26T00:00:00Z"
      )
  };
}

describe(
  "WebhookApplicationService",
  () => {
    it("enqueues pull request work and deduplicates it", async () => {
      const service =
        new WebhookApplicationService(
          new InMemoryJobStore()
        );

      expect(
        await service
          .acceptNormalizedEvent(
            event(42)
          )
      ).toBe("ENQUEUED");

      expect(
        await service
          .acceptNormalizedEvent(
            event(42)
          )
      ).toBe("DUPLICATE");
    });

    it("ignores events without a contribution number", async () => {
      const service =
        new WebhookApplicationService(
          new InMemoryJobStore()
        );

      expect(
        await service
          .acceptNormalizedEvent(
            event(null)
          )
      ).toBe("IGNORED");
    });
  }
);

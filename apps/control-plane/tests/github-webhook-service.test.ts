import {
  createHmac
} from "node:crypto";

import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  InMemoryJobStore
} from "@contribos/worker";

import {
  GitHubWebhookService,
  type WebhookDeliveryLifecycle
} from "../src/github-webhook-service.js";
import {
  WebhookApplicationService
} from "../src/webhook-application-service.js";

class MemoryDeliveryLifecycle
  implements WebhookDeliveryLifecycle
{
  readonly claimed = new Set<string>();
  readonly processed = new Set<string>();
  readonly metadata: unknown[] = [];
  readonly failures: Array<{
    deliveryId: string;
    errorCode: string;
    retryable: boolean;
  }> = [];

  async tryClaim(
    deliveryId: string
  ): Promise<boolean> {
    if (this.claimed.has(deliveryId)) {
      return false;
    }

    this.claimed.add(deliveryId);
    return true;
  }

  async hasProcessed(
    deliveryId: string
  ): Promise<boolean> {
    return this.processed.has(deliveryId);
  }

  async markProcessed(
    deliveryId: string
  ): Promise<void> {
    this.processed.add(deliveryId);
  }

  async markFailed(
    deliveryId: string,
    errorCode: string,
    retryable = false
  ): Promise<void> {
    this.failures.push({
      deliveryId,
      errorCode,
      retryable
    });
  }

  async recordMetadata(
    input: unknown
  ): Promise<void> {
    this.metadata.push(input);
  }
}

function signature(
  rawBody: string,
  secret: string
): string {
  return (
    "sha256=" +
    createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex")
  );
}

function pullRequestBody(
  extra: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    action: "synchronize",
    number: 42,
    installation: { id: 10 },
    repository: {
      id: 20,
      html_url:
        "https://github.com/example/repo"
    },
    pull_request: {
      id: 100,
      number: 42,
      html_url:
        "https://example.test/pr/42",
      head: { sha: "abc123" },
      updated_at:
        "2026-08-26T00:00:00Z"
    },
    ...extra
  });
}

describe("GitHubWebhookService", () => {
  it("verifies, claims, normalizes, queues, and marks processed", async () => {
    const secret = "test-secret";
    const rawBody = pullRequestBody();
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service =
      new GitHubWebhookService(
        secret,
        deliveries,
        new WebhookApplicationService(
          new InMemoryJobStore()
        )
      );

    const result = await service.handle({
      rawBody,
      deliveryId: "delivery-1",
      eventName: "pull_request",
      signature:
        signature(rawBody, secret),
      receivedAt:
        new Date(
          "2026-08-26T00:00:00Z"
        )
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.status).toBe(
      "ENQUEUED"
    );
    expect(
      deliveries.processed.has(
        "delivery-1"
      )
    ).toBe(true);
  });

  it("rejects an invalid signature before parsing or claiming", async () => {
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service =
      new GitHubWebhookService(
        "secret",
        deliveries,
        new WebhookApplicationService(
          new InMemoryJobStore()
        )
      );

    const result = await service.handle({
      rawBody: "{not-json",
      deliveryId: "delivery-2",
      eventName: "pull_request",
      signature: "sha256=invalid"
    });

    expect(result.statusCode).toBe(401);
    expect(result.body.reasonCode).toBe(
      "INVALID_SIGNATURE"
    );
    expect(deliveries.claimed.size).toBe(0);
  });

  it("does not persist raw GitHub webhook payloads", async () => {
    const secret = "test-secret";
    const rawBody = pullRequestBody({
      sender: {
        login: "private-user",
        email:
          "sensitive@example.test"
      },
      secret_sentinel:
        "must-not-be-persisted"
    });
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service =
      new GitHubWebhookService(
        secret,
        deliveries,
        new WebhookApplicationService(
          new InMemoryJobStore()
        )
      );

    await service.handle({
      rawBody,
      deliveryId: "delivery-minimized",
      eventName: "pull_request",
      signature:
        signature(rawBody, secret)
    });

    const stored = JSON.stringify(
      deliveries.metadata
    );

    expect(stored).not.toContain(
      "sensitive@example.test"
    );
    expect(stored).not.toContain(
      "must-not-be-persisted"
    );
    expect(stored).toContain(
      "PULL_REQUEST"
    );
    expect(stored).toContain(
      "abc123"
    );
  });

  it("marks enqueue failures retryable", async () => {
    const secret = "test-secret";
    const rawBody = pullRequestBody();
    const deliveries =
      new MemoryDeliveryLifecycle();

    const webhooks = {
      acceptNormalizedEvent:
        vi.fn(async () => {
          throw new Error("queue unavailable");
        })
    };

    const service =
      new GitHubWebhookService(
        secret,
        deliveries,
        webhooks as never
      );

    await expect(
      service.handle({
        rawBody,
        deliveryId:
          "delivery-retryable",
        eventName: "pull_request",
        signature:
          signature(rawBody, secret)
      })
    ).rejects.toThrow(
      "queue unavailable"
    );

    expect(deliveries.failures).toContainEqual({
      deliveryId:
        "delivery-retryable",
      errorCode:
        "WEBHOOK_ENQUEUE_FAILED",
      retryable: true
    });
  });
});

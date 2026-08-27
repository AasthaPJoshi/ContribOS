import {
  createHmac
} from "node:crypto";

import {
  describe,
  expect,
  it
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

  async markFailed(): Promise<void> {}
  async recordMetadata(): Promise<void> {}
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

describe("GitHubWebhookService", () => {
  it("verifies, claims, normalizes, queues, and marks processed", async () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({
      action: "synchronize",
      number: 42,
      installation: { id: 10 },
      repository: { id: 20 },
      pull_request: {
        id: 100,
        number: 42,
        html_url: "https://example.test/pr/42",
        head: { sha: "abc123" },
        updated_at: "2026-08-26T00:00:00Z"
      }
    });

    const deliveries =
      new MemoryDeliveryLifecycle();

    const service = new GitHubWebhookService(
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
      signature: signature(rawBody, secret),
      receivedAt:
        new Date("2026-08-26T00:00:00Z")
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.status).toBe("ENQUEUED");
    expect(
      deliveries.processed.has("delivery-1")
    ).toBe(true);
  });

  it("rejects an invalid signature before claiming", async () => {
    const deliveries =
      new MemoryDeliveryLifecycle();

    const service = new GitHubWebhookService(
      "secret",
      deliveries,
      new WebhookApplicationService(
        new InMemoryJobStore()
      )
    );

    const result = await service.handle({
      rawBody: "{}",
      deliveryId: "delivery-2",
      eventName: "pull_request",
      signature: "sha256=invalid"
    });

    expect(result.statusCode).toBe(401);
    expect(deliveries.claimed.size).toBe(0);
  });
});

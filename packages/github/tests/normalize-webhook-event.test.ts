import { describe, expect, it } from "vitest";

import { normalizeGitHubWebhookEvent } from "../src/normalize-webhook-event.js";

describe("normalizeGitHubWebhookEvent", () => {
  it("normalizes a pull_request webhook", () => {
    const event = normalizeGitHubWebhookEvent({
      deliveryId: "delivery-pr",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T01:00:00.000Z"),
      payload: {
        action: "opened",
        number: 42,
        pull_request: {
          id: 456,
          html_url: "https://github.com/example/repo/pull/42",
          updated_at: "2026-08-25T00:59:00.000Z",
          head: { sha: "abc123" }
        }
      }
    });

    expect(event).toMatchObject({
      deliveryId: "delivery-pr",
      eventName: "pull_request",
      action: "opened",
      installationId: 1001,
      repositoryId: 2002,
      objectType: "PULL_REQUEST",
      objectId: "456",
      objectUrl: "https://github.com/example/repo/pull/42",
      contributionNumber: 42,
      headSha: "abc123"
    });
  });

  it("normalizes a pull_request_review webhook", () => {
    const event = normalizeGitHubWebhookEvent({
      deliveryId: "delivery-review",
      eventName: "pull_request_review",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T01:00:00.000Z"),
      payload: {
        action: "submitted",
        review: {
          id: 9001,
          html_url: "https://github.com/example/repo/pull/42#pullrequestreview-9001",
          submitted_at: "2026-08-25T00:58:00.000Z"
        },
        pull_request: {
          number: 42,
          html_url: "https://github.com/example/repo/pull/42",
          head: { sha: "abc123" }
        }
      }
    });

    expect(event).toMatchObject({
      objectType: "REVIEW",
      objectId: "9001",
      contributionNumber: 42,
      headSha: "abc123"
    });
  });

  it("normalizes a check_run webhook", () => {
    const event = normalizeGitHubWebhookEvent({
      deliveryId: "delivery-check",
      eventName: "check_run",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T01:00:00.000Z"),
      payload: {
        action: "completed",
        repository: { html_url: "https://github.com/example/repo" },
        check_run: {
          id: 7001,
          html_url: "https://github.com/example/repo/runs/7001",
          head_sha: "abc123",
          completed_at: "2026-08-25T00:57:00.000Z",
          pull_requests: [{ number: 42 }]
        }
      }
    });

    expect(event).toMatchObject({
      objectType: "CHECK_RUN",
      objectId: "7001",
      contributionNumber: 42,
      headSha: "abc123"
    });
  });

  it("normalizes a check_suite webhook", () => {
    const event = normalizeGitHubWebhookEvent({
      deliveryId: "delivery-suite",
      eventName: "check_suite",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T01:00:00.000Z"),
      payload: {
        action: "completed",
        repository: { html_url: "https://github.com/example/repo" },
        check_suite: {
          id: 8001,
          url: "https://api.github.com/repos/example/repo/check-suites/8001",
          head_sha: "abc123",
          updated_at: "2026-08-25T00:56:00.000Z",
          pull_requests: [{ number: 42 }]
        }
      }
    });

    expect(event).toMatchObject({
      objectType: "CHECK_SUITE",
      objectId: "8001",
      contributionNumber: 42,
      headSha: "abc123"
    });
  });

  it("normalizes a workflow_run webhook", () => {
    const event = normalizeGitHubWebhookEvent({
      deliveryId: "delivery-workflow",
      eventName: "workflow_run",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T01:00:00.000Z"),
      payload: {
        action: "completed",
        repository: { html_url: "https://github.com/example/repo" },
        workflow_run: {
          id: 6001,
          html_url: "https://github.com/example/repo/actions/runs/6001",
          head_sha: "abc123",
          updated_at: "2026-08-25T00:55:00.000Z",
          pull_requests: [{ number: 42 }]
        }
      }
    });

    expect(event).toMatchObject({
      objectType: "WORKFLOW_RUN",
      objectId: "6001",
      contributionNumber: 42,
      headSha: "abc123"
    });
  });

  it("returns null for malformed supported payloads", () => {
    const event = normalizeGitHubWebhookEvent({
      deliveryId: "delivery-invalid",
      eventName: "pull_request",
      installationId: 1001,
      repositoryId: 2002,
      receivedAt: new Date("2026-08-25T01:00:00.000Z"),
      payload: { action: "opened" }
    });

    expect(event).toBeNull();
  });
});

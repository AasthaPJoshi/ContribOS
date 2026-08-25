import { isSupportedGitHubWebhookAction } from "./supported-webhook-actions.js";
import { isSupportedGitHubWebhookEvent } from "./supported-webhook-events.js";
import { getGitHubWebhookAction } from "./webhook-payload.js";

import type { GitHubWebhookEnvelope } from "./webhook-envelope.js";
import type { NormalizedGitHubWebhookEvent } from "./normalized-webhook-event.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function getString(record: UnknownRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(record: UnknownRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRecord(record: UnknownRecord | null, key: string): UnknownRecord | null {
  return asRecord(record?.[key]);
}

function getHeadSha(record: UnknownRecord | null): string | null {
  const direct = getString(record, "head_sha");

  if (direct) {
    return direct;
  }

  const head = getRecord(record, "head");
  return getString(head, "sha");
}

function getFirstPullRequestNumber(record: UnknownRecord | null): number | null {
  const pullRequests = record?.["pull_requests"];

  if (!Array.isArray(pullRequests) || pullRequests.length === 0) {
    return null;
  }

  const first = asRecord(pullRequests[0]);
  return getNumber(first, "number");
}

function getRepositoryUrl(payload: UnknownRecord | null): string | null {
  return getString(getRecord(payload, "repository"), "html_url");
}

function getOccurredAt(
  record: UnknownRecord | null,
  keys: readonly string[],
  fallback: Date
): Date {
  for (const key of keys) {
    const value = getString(record, key);

    if (value) {
      const parsed = new Date(value);

      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return fallback;
}

export function normalizeGitHubWebhookEvent(
  envelope: GitHubWebhookEnvelope
): NormalizedGitHubWebhookEvent | null {
  if (
    !isSupportedGitHubWebhookEvent(envelope.eventName) ||
    envelope.installationId === null ||
    envelope.repositoryId === null
  ) {
    return null;
  }

  const action = getGitHubWebhookAction(envelope.payload);

  if (
    !action ||
    !isSupportedGitHubWebhookAction(envelope.eventName, action)
  ) {
    return null;
  }

  const payload = asRecord(envelope.payload);

  if (!payload) {
    return null;
  }

  if (envelope.eventName === "pull_request") {
    const pullRequest = getRecord(payload, "pull_request");
    const objectId = getNumber(pullRequest, "id");
    const objectUrl = getString(pullRequest, "html_url");
    const contributionNumber =
      getNumber(payload, "number") ?? getNumber(pullRequest, "number");

    if (objectId === null || !objectUrl || contributionNumber === null) {
      return null;
    }

    return {
      deliveryId: envelope.deliveryId,
      eventName: envelope.eventName,
      action,
      installationId: envelope.installationId,
      repositoryId: envelope.repositoryId,
      objectType: "PULL_REQUEST",
      objectId: String(objectId),
      objectUrl,
      contributionNumber,
      headSha: getHeadSha(pullRequest),
      occurredAt: getOccurredAt(
        pullRequest,
        ["updated_at", "created_at", "closed_at", "merged_at"],
        envelope.receivedAt
      )
    };
  }

  if (envelope.eventName === "pull_request_review") {
    const review = getRecord(payload, "review");
    const pullRequest = getRecord(payload, "pull_request");
    const objectId = getNumber(review, "id");
    const objectUrl =
      getString(review, "html_url") ?? getString(pullRequest, "html_url");
    const contributionNumber =
      getNumber(pullRequest, "number") ?? getNumber(payload, "number");

    if (objectId === null || !objectUrl || contributionNumber === null) {
      return null;
    }

    return {
      deliveryId: envelope.deliveryId,
      eventName: envelope.eventName,
      action,
      installationId: envelope.installationId,
      repositoryId: envelope.repositoryId,
      objectType: "REVIEW",
      objectId: String(objectId),
      objectUrl,
      contributionNumber,
      headSha: getHeadSha(pullRequest),
      occurredAt: getOccurredAt(
        review,
        ["submitted_at", "updated_at"],
        envelope.receivedAt
      )
    };
  }

  if (envelope.eventName === "check_run") {
    const checkRun = getRecord(payload, "check_run");
    const objectId = getNumber(checkRun, "id");
    const objectUrl =
      getString(checkRun, "html_url") ?? getRepositoryUrl(payload);

    if (objectId === null || !objectUrl) {
      return null;
    }

    return {
      deliveryId: envelope.deliveryId,
      eventName: envelope.eventName,
      action,
      installationId: envelope.installationId,
      repositoryId: envelope.repositoryId,
      objectType: "CHECK_RUN",
      objectId: String(objectId),
      objectUrl,
      contributionNumber: getFirstPullRequestNumber(checkRun),
      headSha: getHeadSha(checkRun),
      occurredAt: getOccurredAt(
        checkRun,
        ["completed_at", "started_at"],
        envelope.receivedAt
      )
    };
  }

  if (envelope.eventName === "check_suite") {
    const checkSuite = getRecord(payload, "check_suite");
    const objectId = getNumber(checkSuite, "id");
    const objectUrl =
      getString(checkSuite, "url") ?? getRepositoryUrl(payload);

    if (objectId === null || !objectUrl) {
      return null;
    }

    return {
      deliveryId: envelope.deliveryId,
      eventName: envelope.eventName,
      action,
      installationId: envelope.installationId,
      repositoryId: envelope.repositoryId,
      objectType: "CHECK_SUITE",
      objectId: String(objectId),
      objectUrl,
      contributionNumber: getFirstPullRequestNumber(checkSuite),
      headSha: getHeadSha(checkSuite),
      occurredAt: getOccurredAt(
        checkSuite,
        ["updated_at", "created_at"],
        envelope.receivedAt
      )
    };
  }

  const workflowRun = getRecord(payload, "workflow_run");
  const objectId = getNumber(workflowRun, "id");
  const objectUrl =
    getString(workflowRun, "html_url") ?? getRepositoryUrl(payload);

  if (objectId === null || !objectUrl) {
    return null;
  }

  return {
    deliveryId: envelope.deliveryId,
    eventName: envelope.eventName,
    action,
    installationId: envelope.installationId,
    repositoryId: envelope.repositoryId,
    objectType: "WORKFLOW_RUN",
    objectId: String(objectId),
    objectUrl,
    contributionNumber: getFirstPullRequestNumber(workflowRun),
    headSha: getHeadSha(workflowRun),
    occurredAt: getOccurredAt(
      workflowRun,
      ["updated_at", "run_started_at", "created_at"],
      envelope.receivedAt
    )
  };
}

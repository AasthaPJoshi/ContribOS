import {
  ingestWebhook,
  normalizeGitHubWebhookEvent,
  type GitHubWebhookEnvelope,
  type WebhookDeliveryStore
} from "@contribos/github";

import type {
  WebhookApplicationService
} from "./webhook-application-service.js";

type UnknownRecord =
  Record<string, unknown>;

export interface WebhookDeliveryLifecycle
  extends WebhookDeliveryStore
{
  recordMetadata(input: {
    deliveryId: string;
    eventName: string;
    action?: string | null;
    githubInstallationId?: string | null;
    githubRepositoryId?: string | null;
    payload?: unknown;
    receivedAt?: Date | null;
  }): Promise<void>;

  markProcessed(
    deliveryId: string
  ): Promise<void>;

  markFailed(
    deliveryId: string,
    errorCode: string
  ): Promise<void>;
}

export interface GitHubWebhookHttpInput {
  rawBody: string;
  deliveryId: string | undefined;
  eventName: string | undefined;
  signature: string | undefined;
  receivedAt?: Date;
}

export interface GitHubWebhookHttpResult {
  statusCode: number;
  body: {
    status: string;
    reasonCode: string;
    deliveryId?: string;
  };
}

function asRecord(
  value: unknown
): UnknownRecord | null {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
    ? value as UnknownRecord
    : null;
}

function nestedId(
  payload: UnknownRecord | null,
  key: string
): number | null {
  const nested =
    asRecord(payload?.[key]);

  const id = nested?.["id"];

  return (
    typeof id === "number" &&
    Number.isSafeInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

function getAction(
  payload: UnknownRecord | null
): string | null {
  const value = payload?.["action"];

  return (
    typeof value === "string" &&
    value.trim()
  )
    ? value.trim()
    : null;
}

export class GitHubWebhookService {
  constructor(
    private readonly secret: string,
    private readonly deliveries:
      WebhookDeliveryLifecycle,
    private readonly webhooks:
      WebhookApplicationService
  ) {}

  async handle(
    input: GitHubWebhookHttpInput
  ): Promise<GitHubWebhookHttpResult> {
    if (!input.deliveryId?.trim()) {
      return {
        statusCode: 400,
        body: {
          status: "REJECTED",
          reasonCode: "MISSING_DELIVERY_ID"
        }
      };
    }

    if (!input.eventName?.trim()) {
      return {
        statusCode: 400,
        body: {
          status: "REJECTED",
          reasonCode: "MISSING_EVENT_NAME",
          deliveryId: input.deliveryId
        }
      };
    }

    let payload: unknown;

    try {
      payload = JSON.parse(input.rawBody);
    } catch {
      return {
        statusCode: 400,
        body: {
          status: "REJECTED",
          reasonCode: "INVALID_JSON",
          deliveryId: input.deliveryId
        }
      };
    }

    const payloadRecord = asRecord(payload);

    const envelope: GitHubWebhookEnvelope = {
      deliveryId: input.deliveryId,
      eventName: input.eventName,
      installationId:
        nestedId(payloadRecord, "installation"),
      repositoryId:
        nestedId(payloadRecord, "repository"),
      receivedAt: input.receivedAt ?? new Date(),
      payload
    };

    const result = await ingestWebhook(
      {
        rawBody: input.rawBody,
        signatureHeader: input.signature,
        webhookSecret: this.secret,
        envelope
      },
      this.deliveries
    );

    if (result.status === "REJECTED") {
      return {
        statusCode:
          result.reasonCode === "INVALID_SIGNATURE"
            ? 401
            : 400,
        body: {
          status: result.status,
          reasonCode: result.reasonCode,
          deliveryId: result.deliveryId
        }
      };
    }

    if (result.status === "DUPLICATE") {
      return {
        statusCode: 202,
        body: {
          status: result.status,
          reasonCode: result.reasonCode,
          deliveryId: result.deliveryId
        }
      };
    }

    await this.deliveries.recordMetadata({
      deliveryId: envelope.deliveryId,
      eventName: envelope.eventName,
      action: getAction(payloadRecord),
      githubInstallationId:
        envelope.installationId === null
          ? null
          : String(envelope.installationId),
      githubRepositoryId:
        envelope.repositoryId === null
          ? null
          : String(envelope.repositoryId),
      payload,
      receivedAt: envelope.receivedAt
    });

    const normalized =
      normalizeGitHubWebhookEvent(envelope);

    if (!normalized) {
      await this.deliveries.markFailed(
        envelope.deliveryId,
        "NORMALIZATION_FAILED"
      );

      return {
        statusCode: 422,
        body: {
          status: "FAILED",
          reasonCode: "NORMALIZATION_FAILED",
          deliveryId: envelope.deliveryId
        }
      };
    }

    try {
      const enqueueResult =
        await this.webhooks.acceptNormalizedEvent(
          normalized
        );

      await this.deliveries.markProcessed(
        envelope.deliveryId
      );

      return {
        statusCode: 202,
        body: {
          status: enqueueResult,
          reasonCode:
            enqueueResult === "ENQUEUED"
              ? "WORK_ENQUEUED"
              : enqueueResult === "DUPLICATE"
                ? "WORK_ALREADY_QUEUED"
                : "NO_WORK_REQUIRED",
          deliveryId: envelope.deliveryId
        }
      };
    } catch (error) {
      await this.deliveries.markFailed(
        envelope.deliveryId,
        "WEBHOOK_ENQUEUE_FAILED"
      );

      throw error;
    }
  }
}

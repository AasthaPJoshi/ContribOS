import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  eq,
  inArray,
  lt
} from "drizzle-orm";

import type { WebhookDeliveryStore } from "@contribos/github";

import type { ContribOSDatabase } from "../database.js";
import {
  webhookDeliveries,
  type WebhookDeliveryRow
} from "../schema.js";

export interface RecordWebhookMetadataInput {
  deliveryId: string;
  eventName: string;
  action?: string | null;
  githubInstallationId?: string | null;
  githubRepositoryId?: string | null;
  payload?: unknown;
  receivedAt?: Date | null;
}

export interface RecoverStaleClaimsInput {
  staleBefore: Date;
  limit?: number;
}

export class WebhookDeliveryRepository
  implements WebhookDeliveryStore
{
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async tryClaim(
    deliveryId: string
  ): Promise<boolean> {
    const now = new Date();

    const rows = await this.db
      .insert(webhookDeliveries)
      .values({
        id: randomUUID(),
        deliveryId,
        status: "CLAIMED",
        claimedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing({
        target: webhookDeliveries.deliveryId
      })
      .returning({
        id: webhookDeliveries.id
      });

    return rows.length === 1;
  }

  async hasProcessed(
    deliveryId: string
  ): Promise<boolean> {
    const rows = await this.db
      .select({
        status: webhookDeliveries.status
      })
      .from(webhookDeliveries)
      .where(
        eq(
          webhookDeliveries.deliveryId,
          deliveryId
        )
      )
      .limit(1);

    return rows[0]?.status === "PROCESSED";
  }

  async markProcessed(
    deliveryId: string
  ): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        status: "PROCESSED",
        processedAt: new Date(),
        errorCode: null,
        updatedAt: new Date()
      })
      .where(
        eq(
          webhookDeliveries.deliveryId,
          deliveryId
        )
      );
  }

  async markFailed(
    deliveryId: string,
    errorCode: string
  ): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        status: "FAILED",
        errorCode,
        updatedAt: new Date()
      })
      .where(
        eq(
          webhookDeliveries.deliveryId,
          deliveryId
        )
      );
  }

  async recordMetadata(
    input: RecordWebhookMetadataInput
  ): Promise<void> {
    await this.db
      .update(webhookDeliveries)
      .set({
        eventName: input.eventName,
        action: input.action ?? null,
        githubInstallationId:
          input.githubInstallationId ?? null,
        githubRepositoryId:
          input.githubRepositoryId ?? null,
        payload: input.payload ?? null,
        receivedAt: input.receivedAt ?? null,
        updatedAt: new Date()
      })
      .where(
        eq(
          webhookDeliveries.deliveryId,
          input.deliveryId
        )
      );
  }

  async recoverStaleClaims(
    input: RecoverStaleClaimsInput
  ): Promise<WebhookDeliveryRow[]> {
    const limit = input.limit ?? 100;

    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error(
        "recoverStaleClaims limit must be a positive integer."
      );
    }

    const candidates =
      await this.db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(
          and(
            eq(
              webhookDeliveries.status,
              "CLAIMED"
            ),
            lt(
              webhookDeliveries.claimedAt,
              input.staleBefore
            )
          )
        )
        .orderBy(
          asc(webhookDeliveries.claimedAt)
        )
        .limit(limit);

    if (candidates.length === 0) {
      return [];
    }

    return this.db
      .update(webhookDeliveries)
      .set({
        status: "FAILED",
        errorCode: "STALE_CLAIM",
        updatedAt: new Date()
      })
      .where(
        and(
          inArray(
            webhookDeliveries.id,
            candidates.map(({ id }) => id)
          ),
          eq(
            webhookDeliveries.status,
            "CLAIMED"
          ),
          lt(
            webhookDeliveries.claimedAt,
            input.staleBefore
          )
        )
      )
      .returning();
  }
}

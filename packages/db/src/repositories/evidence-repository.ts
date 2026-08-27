import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { EvidenceRef } from "@contribos/domain";

import type { ContribOSDatabase } from "../database.js";
import { evidence, type EvidenceRow } from "../schema.js";

export class EvidenceRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async listByContributionId(
    contributionId: string,
    limit = 100
  ): Promise<EvidenceRow[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("evidence limit must be between 1 and 500.");
    }

    return this.db
      .select()
      .from(evidence)
      .where(eq(evidence.contributionId, contributionId))
      .orderBy(desc(evidence.occurredAt), desc(evidence.capturedAt))
      .limit(limit);
  }

  async upsertMany(
    contributionId: string,
    refs: readonly EvidenceRef[]
  ): Promise<void> {
    for (const ref of refs) {
      await this.db
        .insert(evidence)
        .values({
          id: randomUUID(),
          contributionId,
          evidenceId: ref.id,
          source: ref.source,
          objectType: ref.objectType,
          externalId: ref.externalId,
          url: ref.url,
          occurredAt: ref.occurredAt,
          capturedAt: new Date(),
          createdAt: new Date()
        })
        .onConflictDoUpdate({
          target: evidence.evidenceId,
          set: {
            contributionId,
            source: ref.source,
            objectType: ref.objectType,
            externalId: ref.externalId,
            url: ref.url,
            occurredAt: ref.occurredAt,
            capturedAt: new Date()
          }
        });
    }
  }
}

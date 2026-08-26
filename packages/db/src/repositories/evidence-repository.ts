import { randomUUID } from "node:crypto";

import type { EvidenceRef } from "@contribos/domain";

import type { ContribOSDatabase } from "../database.js";
import { evidence } from "../schema.js";

export class EvidenceRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

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

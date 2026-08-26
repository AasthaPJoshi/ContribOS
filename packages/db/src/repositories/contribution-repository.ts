import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { ContribOSDatabase } from "../database.js";
import {
  contributions,
  type ContributionRow
} from "../schema.js";
import { requireReturnedRow } from "./helpers.js";

export interface UpsertContributionInput {
  repositoryId: string;
  githubPullRequestId: string;
  pullRequestNumber: number;
  url: string;
  headSha: string;
  latestSnapshot?: unknown;
  lastReconciledAt?: Date | null;
}

export class ContributionRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async upsertPullRequest(
    input: UpsertContributionInput
  ): Promise<ContributionRow> {
    const now = new Date();

    const rows = await this.db
      .insert(contributions)
      .values({
        id: randomUUID(),
        repositoryId: input.repositoryId,
        githubPullRequestId:
          input.githubPullRequestId,
        pullRequestNumber:
          input.pullRequestNumber,
        url: input.url,
        headSha: input.headSha,
        latestSnapshot:
          input.latestSnapshot ?? null,
        lastReconciledAt:
          input.lastReconciledAt ?? null,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target:
          contributions.githubPullRequestId,
        set: {
          repositoryId: input.repositoryId,
          pullRequestNumber:
            input.pullRequestNumber,
          url: input.url,
          headSha: input.headSha,
          latestSnapshot:
            input.latestSnapshot ?? null,
          lastReconciledAt:
            input.lastReconciledAt ?? null,
          updatedAt: now
        }
      })
      .returning();

    return requireReturnedRow(
      rows,
      "contribution upsert"
    );
  }

  async findByRepositoryAndNumber(
    repositoryId: string,
    pullRequestNumber: number
  ): Promise<ContributionRow | null> {
    const rows = await this.db
      .select()
      .from(contributions)
      .where(
        and(
          eq(
            contributions.repositoryId,
            repositoryId
          ),
          eq(
            contributions.pullRequestNumber,
            pullRequestNumber
          )
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }
}

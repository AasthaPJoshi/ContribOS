import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ContribOSDatabase } from "../database.js";
import {
  installations,
  type InstallationRow
} from "../schema.js";
import { requireReturnedRow } from "./helpers.js";

export interface UpsertInstallationInput {
  githubInstallationId: string;
  accountLogin?: string | null;
  accountType?: string | null;
  permissions: Record<string, string>;
  repositorySelection?: string | null;
}

export class InstallationRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async upsert(
    input: UpsertInstallationInput
  ): Promise<InstallationRow> {
    const now = new Date();

    const rows = await this.db
      .insert(installations)
      .values({
        id: randomUUID(),
        githubInstallationId:
          input.githubInstallationId,
        accountLogin: input.accountLogin ?? null,
        accountType: input.accountType ?? null,
        permissions: input.permissions,
        repositorySelection:
          input.repositorySelection ?? null,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: installations.githubInstallationId,
        set: {
          accountLogin: input.accountLogin ?? null,
          accountType: input.accountType ?? null,
          permissions: input.permissions,
          repositorySelection:
            input.repositorySelection ?? null,
          updatedAt: now
        }
      })
      .returning();

    return requireReturnedRow(
      rows,
      "installation upsert"
    );
  }

  async findByGitHubInstallationId(
    githubInstallationId: string
  ): Promise<InstallationRow | null> {
    const rows = await this.db
      .select()
      .from(installations)
      .where(
        eq(
          installations.githubInstallationId,
          githubInstallationId
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }
}

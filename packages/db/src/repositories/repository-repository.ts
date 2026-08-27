import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { ContribOSDatabase } from "../database.js";
import {
  repositories,
  type RepositoryRow
} from "../schema.js";
import { requireReturnedRow } from "./helpers.js";

export interface UpsertRepositoryInput {
  installationId: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch?: string | null;
  isPrivate: boolean;
}

export class RepositoryRepository {
  constructor(
    private readonly db: ContribOSDatabase
  ) {}

  async upsert(
    input: UpsertRepositoryInput
  ): Promise<RepositoryRow> {
    const now = new Date();

    const rows = await this.db
      .insert(repositories)
      .values({
        id: randomUUID(),
        installationId: input.installationId,
        githubRepositoryId:
          input.githubRepositoryId,
        owner: input.owner,
        name: input.name,
        fullName: input.fullName,
        defaultBranch:
          input.defaultBranch ?? null,
        isPrivate: input.isPrivate,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: repositories.githubRepositoryId,
        set: {
          installationId: input.installationId,
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          defaultBranch:
            input.defaultBranch ?? null,
          isPrivate: input.isPrivate,
          updatedAt: now
        }
      })
      .returning();

    return requireReturnedRow(
      rows,
      "repository upsert"
    );
  }


  async listByInstallationId(
    installationId: string
  ): Promise<RepositoryRow[]> {
    return this.db
      .select()
      .from(repositories)
      .where(
        eq(
          repositories.installationId,
          installationId
        )
      );
  }

  async findByGitHubRepositoryId(
    githubRepositoryId: string
  ): Promise<RepositoryRow | null> {
    const rows = await this.db
      .select()
      .from(repositories)
      .where(
        eq(
          repositories.githubRepositoryId,
          githubRepositoryId
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }
}

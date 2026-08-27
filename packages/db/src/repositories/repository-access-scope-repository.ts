import {
  eq
} from "drizzle-orm";

import type {
  ContribOSDatabase
} from "../database.js";
import {
  installations,
  repositories
} from "../schema.js";

export interface RepositoryAccessScopeRow {
  repositoryId: string;
  githubRepositoryId: string;
  repositoryFullName: string;
  isPrivate: boolean;
  installationId: string;
  githubInstallationId: string;
}

export class RepositoryAccessScopeRepository {
  constructor(
    private readonly db:
      ContribOSDatabase
  ) {}

  async findByGitHubRepositoryId(
    githubRepositoryId: string
  ): Promise<
    RepositoryAccessScopeRow | null
  > {
    const rows = await this.db
      .select({
        repositoryId:
          repositories.id,
        githubRepositoryId:
          repositories.githubRepositoryId,
        repositoryFullName:
          repositories.fullName,
        isPrivate:
          repositories.isPrivate,
        installationId:
          installations.id,
        githubInstallationId:
          installations.githubInstallationId
      })
      .from(repositories)
      .innerJoin(
        installations,
        eq(
          repositories.installationId,
          installations.id
        )
      )
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

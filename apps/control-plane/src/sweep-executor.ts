import {
  ContributionRepository,
  InstallationRepository,
  RepositoryRepository,
  type ContribOSDatabase
} from "@contribos/db";
import {
  enqueueReconcilePullRequest,
  type JobStore,
  type ReconciliationSweepJobPayload
} from "@contribos/worker";

import type {
  SweepJobExecutor
} from "./application-job-handler.js";

export class DatabaseBackedSweepExecutor
  implements SweepJobExecutor
{
  private readonly installations:
    InstallationRepository;
  private readonly repositories:
    RepositoryRepository;
  private readonly contributions:
    ContributionRepository;

  constructor(
    db: ContribOSDatabase,
    private readonly store: JobStore
  ) {
    this.installations =
      new InstallationRepository(db);
    this.repositories =
      new RepositoryRepository(db);
    this.contributions =
      new ContributionRepository(db);
  }

  async execute(
    payload: ReconciliationSweepJobPayload
  ): Promise<void> {
    const installation =
      await this.installations.findByGitHubInstallationId(
        String(payload.installationId)
      );

    if (!installation) {
      return;
    }

    let repositories;

    if (payload.repositoryId !== undefined) {
      const repository =
        await this.repositories.findByGitHubRepositoryId(
          String(payload.repositoryId)
        );

      repositories =
        repository &&
        repository.installationId === installation.id
          ? [repository]
          : [];
    } else {
      repositories =
        await this.repositories.listByInstallationId(
          installation.id
        );
    }

    for (const repository of repositories) {
      const repositoryId = Number(
        repository.githubRepositoryId
      );

      if (
        !Number.isSafeInteger(repositoryId) ||
        repositoryId <= 0
      ) {
        continue;
      }

      const contributions =
        await this.contributions.listByRepositoryId(
          repository.id
        );

      for (const contribution of contributions) {
        await enqueueReconcilePullRequest(
          this.store,
          {
            installationId: payload.installationId,
            repositoryId,
            pullRequestNumber:
              contribution.pullRequestNumber
          }
        );
      }
    }
  }
}

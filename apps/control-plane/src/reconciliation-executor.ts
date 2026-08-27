import type { PullRequestSnapshot } from "@contribos/domain";
import {
  ContributionRepository,
  RepositoryRepository,
  persistReconciliationTransaction,
  type ContribOSDatabase
} from "@contribos/db";
import {
  reconcilePullRequest,
  type GitHubApiRequester
} from "@contribos/github";
import { evaluatePullRequest } from "@contribos/state-engine";
import type { ReconcilePullRequestJobPayload } from "@contribos/worker";

import type { PullRequestJobExecutor } from "./application-job-handler.js";

export class ReconciliationRetryError extends Error {
  readonly code: string;

  constructor(message: string, code = "RECONCILIATION_RETRY_REQUIRED") {
    super(message);
    this.name = "ReconciliationRetryError";
    this.code = code;
  }
}

export class DatabaseBackedPullRequestExecutor implements PullRequestJobExecutor {
  private readonly repositories: RepositoryRepository;
  private readonly contributions: ContributionRepository;

  constructor(
    private readonly db: ContribOSDatabase,
    private readonly github: GitHubApiRequester
  ) {
    this.repositories = new RepositoryRepository(db);
    this.contributions = new ContributionRepository(db);
  }

  async execute(payload: ReconcilePullRequestJobPayload): Promise<void> {
    const repository = await this.repositories.findByGitHubRepositoryId(
      String(payload.repositoryId)
    );

    if (!repository) {
      const error = new Error("Repository is not registered in ContribOS.") as Error & {
        code: string;
      };
      error.code = "REPOSITORY_NOT_REGISTERED";
      throw error;
    }

    const existing = await this.contributions.findByRepositoryAndNumber(
      repository.id,
      payload.pullRequestNumber
    );

    const observedSnapshot =
      existing?.latestSnapshot && typeof existing.latestSnapshot === "object"
        ? (existing.latestSnapshot as PullRequestSnapshot)
        : undefined;

    const startedAt = new Date();

    const reconciliation = await reconcilePullRequest(
      this.github,
      {
        installationId: payload.installationId,
        repositoryId: payload.repositoryId,
        owner: repository.owner,
        repository: repository.name,
        pullRequestNumber: payload.pullRequestNumber,
        ...(observedSnapshot ? { observedSnapshot } : {})
      }
    );

    if (reconciliation.status === "RETRY_REQUIRED") {
      throw new ReconciliationRetryError(
        reconciliation.reasonCode,
        reconciliation.reasonCode
      );
    }

    if (!reconciliation.snapshot || !reconciliation.record) {
      throw new Error(
        "Reconciliation completed without a stable pull request record."
      );
    }

    const contribution = await this.contributions.upsertPullRequest({
      repositoryId: repository.id,
      githubPullRequestId: reconciliation.record.pullRequestId,
      pullRequestNumber: payload.pullRequestNumber,
      url: reconciliation.record.url,
      headSha: reconciliation.record.headSha,
      latestSnapshot: reconciliation.snapshot,
      lastReconciledAt: reconciliation.reconciledAt
    });

    const evaluation = evaluatePullRequest(reconciliation.snapshot);

    await persistReconciliationTransaction(this.db, {
      contributionId: contribution.id,
      reconciliation,
      evaluation,
      startedAt,
      completedAt: new Date()
    });
  }
}

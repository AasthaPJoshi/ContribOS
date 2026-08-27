import {
  buildRepositoryDashboard,
  type RepositoryDashboard
} from "./repository-dashboard.js";

import {
  buildContributionDecisionTrail,
  type ContributionDecisionTrail
} from "./contribution-decision-trail.js";

import {
  buildMaintainerAttentionQueue,
  type AttentionCandidate,
  type AttentionQueueOptions,
  type AttentionQueuePage
} from "./maintainer-attention-queue.js";

import {
  ContributionRepository,
  EvidenceRepository,
  ReconciliationRunRepository,
  RepositoryRepository,
  StateEvaluationRepository,
  StateHistoryRepository,
  type ContribOSDatabase,
  type EvidenceRow,
  type ReconciliationRunRow,
  type StateHistoryRow
} from "@contribos/db";

export interface ContributionQuery {
  githubRepositoryId: number;
  pullRequestNumber: number;
}

export interface ContributionDetail {
  repository: {
    id: string;
    githubRepositoryId: string;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string | null;
    isPrivate: boolean;
  };
  contribution: {
    id: string;
    githubPullRequestId: string;
    pullRequestNumber: number;
    url: string;
    headSha: string;
    lastReconciledAt: Date | null;
  };
  currentState: {
    workflowState: string;
    nextActor: string;
    readiness: string;
    reasonCode: string;
    explanation: string;
    engineVersion: string;
    evaluatedAt: Date;
  } | null;
}

export interface RepositoryContributionSummary {
  id: string;
  pullRequestNumber: number;
  url: string;
  headSha: string;
  lastReconciledAt: Date | null;
  workflowState: string | null;
  nextActor: string | null;
  readiness: string | null;
  reasonCode: string | null;
}

export interface RepositoryOverview {
  repository: ContributionDetail["repository"];
  contributionCount: number;
  contributions: RepositoryContributionSummary[];
}

export interface ContributionTimeline {
  stateHistory: StateHistoryRow[];
  evidence: EvidenceRow[];
  reconciliationRuns: ReconciliationRunRow[];
}

export class ProductQueryService {
  private readonly repositories: RepositoryRepository;
  private readonly contributions: ContributionRepository;
  private readonly evaluations: StateEvaluationRepository;
  private readonly history: StateHistoryRepository;
  private readonly evidence: EvidenceRepository;
  private readonly reconciliations: ReconciliationRunRepository;

  constructor(db: ContribOSDatabase) {
    this.repositories = new RepositoryRepository(db);
    this.contributions = new ContributionRepository(db);
    this.evaluations = new StateEvaluationRepository(db);
    this.history = new StateHistoryRepository(db);
    this.evidence = new EvidenceRepository(db);
    this.reconciliations = new ReconciliationRunRepository(db);
  }

  async getContributionDetail(
    query: ContributionQuery
  ): Promise<ContributionDetail | null> {
    const repository = await this.repositories.findByGitHubRepositoryId(
      String(query.githubRepositoryId)
    );

    if (!repository) return null;

    const contribution = await this.contributions.findByRepositoryAndNumber(
      repository.id,
      query.pullRequestNumber
    );

    if (!contribution) return null;

    const evaluation = await this.evaluations.findLatestByContributionId(
      contribution.id
    );

    return {
      repository: {
        id: repository.id,
        githubRepositoryId: repository.githubRepositoryId,
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        isPrivate: repository.isPrivate
      },
      contribution: {
        id: contribution.id,
        githubPullRequestId: contribution.githubPullRequestId,
        pullRequestNumber: contribution.pullRequestNumber,
        url: contribution.url,
        headSha: contribution.headSha,
        lastReconciledAt: contribution.lastReconciledAt
      },
      currentState: evaluation
        ? {
            workflowState: evaluation.workflowState,
            nextActor: evaluation.nextActor,
            readiness: evaluation.readiness,
            reasonCode: evaluation.reasonCode,
            explanation: evaluation.explanation,
            engineVersion: evaluation.engineVersion,
            evaluatedAt: evaluation.evaluatedAt
          }
        : null
    };
  }

  async getRepositoryOverview(
    githubRepositoryId: number
  ): Promise<RepositoryOverview | null> {
    const repository = await this.repositories.findByGitHubRepositoryId(
      String(githubRepositoryId)
    );

    if (!repository) return null;

    const contributions = await this.contributions.listByRepositoryId(
      repository.id
    );

    const summaries = await Promise.all(
      contributions.map(async (contribution) => {
        const evaluation = await this.evaluations.findLatestByContributionId(
          contribution.id
        );

        return {
          id: contribution.id,
          pullRequestNumber: contribution.pullRequestNumber,
          url: contribution.url,
          headSha: contribution.headSha,
          lastReconciledAt: contribution.lastReconciledAt,
          workflowState: evaluation?.workflowState ?? null,
          nextActor: evaluation?.nextActor ?? null,
          readiness: evaluation?.readiness ?? null,
          reasonCode: evaluation?.reasonCode ?? null
        };
      })
    );

    summaries.sort(
      (left, right) => right.pullRequestNumber - left.pullRequestNumber
    );

    return {
      repository: {
        id: repository.id,
        githubRepositoryId: repository.githubRepositoryId,
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        isPrivate: repository.isPrivate
      },
      contributionCount: summaries.length,
      contributions: summaries
    };
  }

  async getRepositoryDashboard(
    githubRepositoryId: number
  ): Promise<RepositoryDashboard | null> {
    const overview =
      await this.getRepositoryOverview(
        githubRepositoryId
      );

    if (!overview) {
      return null;
    }

    return buildRepositoryDashboard(
      overview
    );
  }

  async getMaintainerAttentionQueue(
    githubRepositoryId: number,
    options: AttentionQueueOptions = {}
  ): Promise<AttentionQueuePage | null> {
    const repository =
      await this.repositories.findByGitHubRepositoryId(
        String(githubRepositoryId)
      );

    if (!repository) {
      return null;
    }

    const contributions =
      await this.contributions.listByRepositoryId(
        repository.id
      );

    const candidates: AttentionCandidate[] =
      await Promise.all(
        contributions.map(async (contribution) => {
          const evaluation =
            await this.evaluations.findLatestByContributionId(
              contribution.id
            );

          return {
            contributionId: contribution.id,
            repositoryId: repository.id,
            repositoryFullName: repository.fullName,
            pullRequestNumber:
              contribution.pullRequestNumber,
            url: contribution.url,
            updatedAt: contribution.updatedAt,
            lastReconciledAt:
              contribution.lastReconciledAt,
            workflowState:
              evaluation?.workflowState ?? null,
            nextActor:
              evaluation?.nextActor ?? null,
            readiness:
              evaluation?.readiness ?? null,
            reasonCode:
              evaluation?.reasonCode ?? null
          };
        })
      );

    return buildMaintainerAttentionQueue(
      candidates,
      options
    );
  }

  async getContributionDecisionTrail(
    query: ContributionQuery,
    limit = 100
  ): Promise<ContributionDecisionTrail | null> {
    const timeline =
      await this.getContributionTimeline(
        query,
        limit
      );

    if (!timeline) {
      return null;
    }

    return buildContributionDecisionTrail(
      timeline.stateHistory,
      timeline.evidence,
      timeline.reconciliationRuns
    );
  }

  async getContributionTimeline(
    query: ContributionQuery,
    limit = 100
  ): Promise<ContributionTimeline | null> {
    const repository = await this.repositories.findByGitHubRepositoryId(
      String(query.githubRepositoryId)
    );

    if (!repository) return null;

    const contribution = await this.contributions.findByRepositoryAndNumber(
      repository.id,
      query.pullRequestNumber
    );

    if (!contribution) return null;

    const [stateHistory, evidence, reconciliationRuns] = await Promise.all([
      this.history.listByContributionId(contribution.id, limit),
      this.evidence.listByContributionId(contribution.id, limit),
      this.reconciliations.listByContributionId(contribution.id, limit)
    ]);

    return {
      stateHistory,
      evidence,
      reconciliationRuns
    };
  }
}

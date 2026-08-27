import type {
  AttentionQueuePage,
  ContributionDecisionTrail,
  ContributionDetail,
  RepositoryDashboard,
  RepositoryOverview
} from "./types.js";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly reasonCode: string
  ) {
    super(reasonCode);
    this.name = "ApiError";
  }
}

async function getJson<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    headers: {
      accept: "application/json"
    },
    ...(signal ? { signal } : {})
  });

  if (!response.ok) {
    let reasonCode = `HTTP_${response.status}`;

    try {
      const body = await response.json() as {
        reasonCode?: string;
        status?: string;
      };

      reasonCode =
        body.reasonCode ??
        body.status ??
        reasonCode;
    } catch {
      // Keep the status-derived reason code.
    }

    throw new ApiError(
      response.status,
      reasonCode
    );
  }

  return response.json() as Promise<T>;
}

function repositoryPath(
  githubRepositoryId: number
): string {
  return `/api/repositories/${githubRepositoryId}`;
}

export interface AttentionQuery {
  page?: number;
  pageSize?: number;
  workflowState?: string;
  readiness?: string;
  nextActor?: string;
}

export const contribOSApi = {
  repositoryOverview(
    githubRepositoryId: number,
    signal?: AbortSignal
  ): Promise<RepositoryOverview> {
    return getJson(
      repositoryPath(githubRepositoryId),
      signal
    );
  },

  repositoryDashboard(
    githubRepositoryId: number,
    signal?: AbortSignal
  ): Promise<RepositoryDashboard> {
    return getJson(
      `${repositoryPath(
        githubRepositoryId
      )}/dashboard`,
      signal
    );
  },

  attentionQueue(
    githubRepositoryId: number,
    query: AttentionQuery = {},
    signal?: AbortSignal
  ): Promise<AttentionQueuePage> {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }

    const suffix = params.size
      ? `?${params.toString()}`
      : "";

    return getJson(
      `${repositoryPath(
        githubRepositoryId
      )}/attention${suffix}`,
      signal
    );
  },

  contributionDetail(
    githubRepositoryId: number,
    pullRequestNumber: number,
    signal?: AbortSignal
  ): Promise<ContributionDetail> {
    return getJson(
      `${repositoryPath(
        githubRepositoryId
      )}/contributions/${pullRequestNumber}`,
      signal
    );
  },

  contributionDecisionTrail(
    githubRepositoryId: number,
    pullRequestNumber: number,
    limit = 100,
    signal?: AbortSignal
  ): Promise<ContributionDecisionTrail> {
    return getJson(
      `${repositoryPath(
        githubRepositoryId
      )}/contributions/${pullRequestNumber}/decision-trail?limit=${limit}`,
      signal
    );
  }
};

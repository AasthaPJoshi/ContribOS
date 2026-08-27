import type { IncomingMessage } from "node:http";

import type {
  AttentionQueueOptions
} from "./maintainer-attention-queue.js";
import type {
  ProductQueryService
} from "./product-query-service.js";

export interface ProductHttpResult {
  handled: boolean;
  statusCode: number;
  body: unknown;
}

export type ProductQueryApi = Pick<
  ProductQueryService,
  | "getRepositoryOverview"
  | "getRepositoryDashboard"
  | "getMaintainerAttentionQueue"
  | "getContributionDetail"
  | "getContributionDecisionTrail"
>;

function badRequest(
  reasonCode: string
): ProductHttpResult {
  return {
    handled: true,
    statusCode: 400,
    body: {
      status: "ERROR",
      reasonCode
    }
  };
}

function notFound(): ProductHttpResult {
  return {
    handled: true,
    statusCode: 404,
    body: {
      status: "NOT_FOUND"
    }
  };
}

function parsePositiveInteger(
  value: string | null,
  reasonCode: string
): number | ProductHttpResult {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return badRequest(reasonCode);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return badRequest(reasonCode);
  }

  return parsed;
}

function parseOptionalPositiveInteger(
  value: string | null,
  defaultValue: number,
  maximum: number,
  reasonCode: string
): number | ProductHttpResult {
  if (value === null) {
    return defaultValue;
  }

  const parsed = parsePositiveInteger(
    value,
    reasonCode
  );

  if (typeof parsed !== "number") {
    return parsed;
  }

  if (parsed > maximum) {
    return badRequest(reasonCode);
  }

  return parsed;
}

function queryOptions(
  url: URL
): AttentionQueueOptions | ProductHttpResult {
  const page = parseOptionalPositiveInteger(
    url.searchParams.get("page"),
    1,
    Number.MAX_SAFE_INTEGER,
    "INVALID_PAGE"
  );

  if (typeof page !== "number") {
    return page;
  }

  const pageSize = parseOptionalPositiveInteger(
    url.searchParams.get("pageSize"),
    25,
    100,
    "INVALID_PAGE_SIZE"
  );

  if (typeof pageSize !== "number") {
    return pageSize;
  }

  const filters: NonNullable<
    AttentionQueueOptions["filters"]
  > = {};

  const workflowState =
    url.searchParams.get("workflowState");
  const readiness =
    url.searchParams.get("readiness");
  const nextActor =
    url.searchParams.get("nextActor");

  if (workflowState) {
    filters.workflowState = workflowState;
  }

  if (readiness) {
    filters.readiness = readiness;
  }

  if (nextActor) {
    filters.nextActor = nextActor;
  }

  return {
    page,
    pageSize,
    filters
  };
}

export async function handleProductHttpRequest(
  request: IncomingMessage,
  queries: ProductQueryApi
): Promise<ProductHttpResult> {
  if (request.method !== "GET") {
    return {
      handled: false,
      statusCode: 404,
      body: null
    };
  }

  const url = new URL(
    request.url ?? "/",
    "http://contribos.local"
  );

  const repositoryMatch =
    /^\/api\/repositories\/([^/]+)$/.exec(
      url.pathname
    );

  if (repositoryMatch) {
    const githubRepositoryId =
      parsePositiveInteger(
        repositoryMatch[1] ?? null,
        "INVALID_REPOSITORY_ID"
      );

    if (
      typeof githubRepositoryId !==
      "number"
    ) {
      return githubRepositoryId;
    }

    const result =
      await queries.getRepositoryOverview(
        githubRepositoryId
      );

    return result
      ? {
          handled: true,
          statusCode: 200,
          body: result
        }
      : notFound();
  }

  const dashboardMatch =
    /^\/api\/repositories\/([^/]+)\/dashboard$/.exec(
      url.pathname
    );

  if (dashboardMatch) {
    const githubRepositoryId =
      parsePositiveInteger(
        dashboardMatch[1] ?? null,
        "INVALID_REPOSITORY_ID"
      );

    if (
      typeof githubRepositoryId !==
      "number"
    ) {
      return githubRepositoryId;
    }

    const result =
      await queries.getRepositoryDashboard(
        githubRepositoryId
      );

    return result
      ? {
          handled: true,
          statusCode: 200,
          body: result
        }
      : notFound();
  }

  const attentionMatch =
    /^\/api\/repositories\/([^/]+)\/attention$/.exec(
      url.pathname
    );

  if (attentionMatch) {
    const githubRepositoryId =
      parsePositiveInteger(
        attentionMatch[1] ?? null,
        "INVALID_REPOSITORY_ID"
      );

    if (
      typeof githubRepositoryId !==
      "number"
    ) {
      return githubRepositoryId;
    }

    const options = queryOptions(url);

    if ("handled" in options) {
      return options;
    }

    const result =
      await queries
        .getMaintainerAttentionQueue(
          githubRepositoryId,
          options
        );

    return result
      ? {
          handled: true,
          statusCode: 200,
          body: result
        }
      : notFound();
  }

  const contributionMatch =
    /^\/api\/repositories\/([^/]+)\/contributions\/([^/]+)$/.exec(
      url.pathname
    );

  if (contributionMatch) {
    const githubRepositoryId =
      parsePositiveInteger(
        contributionMatch[1] ?? null,
        "INVALID_REPOSITORY_ID"
      );

    if (
      typeof githubRepositoryId !==
      "number"
    ) {
      return githubRepositoryId;
    }

    const pullRequestNumber =
      parsePositiveInteger(
        contributionMatch[2] ?? null,
        "INVALID_PULL_REQUEST_NUMBER"
      );

    if (
      typeof pullRequestNumber !==
      "number"
    ) {
      return pullRequestNumber;
    }

    const result =
      await queries.getContributionDetail({
        githubRepositoryId,
        pullRequestNumber
      });

    return result
      ? {
          handled: true,
          statusCode: 200,
          body: result
        }
      : notFound();
  }

  const trailMatch =
    /^\/api\/repositories\/([^/]+)\/contributions\/([^/]+)\/decision-trail$/.exec(
      url.pathname
    );

  if (trailMatch) {
    const githubRepositoryId =
      parsePositiveInteger(
        trailMatch[1] ?? null,
        "INVALID_REPOSITORY_ID"
      );

    if (
      typeof githubRepositoryId !==
      "number"
    ) {
      return githubRepositoryId;
    }

    const pullRequestNumber =
      parsePositiveInteger(
        trailMatch[2] ?? null,
        "INVALID_PULL_REQUEST_NUMBER"
      );

    if (
      typeof pullRequestNumber !==
      "number"
    ) {
      return pullRequestNumber;
    }

    const limit =
      parseOptionalPositiveInteger(
        url.searchParams.get("limit"),
        100,
        500,
        "INVALID_LIMIT"
      );

    if (typeof limit !== "number") {
      return limit;
    }

    const result =
      await queries
        .getContributionDecisionTrail(
          {
            githubRepositoryId,
            pullRequestNumber
          },
          limit
        );

    return result
      ? {
          handled: true,
          statusCode: 200,
          body: result
        }
      : notFound();
  }

  return {
    handled: false,
    statusCode: 404,
    body: null
  };
}

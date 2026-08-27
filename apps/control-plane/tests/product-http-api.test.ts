import type {
  IncomingMessage
} from "node:http";

import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  handleProductHttpRequest,
  type ProductQueryApi
} from "../src/product-http-api.js";

function request(
  url: string,
  method = "GET"
): IncomingMessage {
  return {
    method,
    url
  } as IncomingMessage;
}

function api(): ProductQueryApi {
  return {
    getRepositoryOverview:
      vi.fn().mockResolvedValue({
        repository: {
          id: "repository-1"
        },
        contributionCount: 0,
        contributions: []
      }),
    getRepositoryDashboard:
      vi.fn().mockResolvedValue({
        repository: {
          id: "repository-1"
        },
        totals: {}
      }),
    getMaintainerAttentionQueue:
      vi.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 0
      }),
    getContributionDetail:
      vi.fn().mockResolvedValue({
        contribution: {
          id: "contribution-1"
        }
      }),
    getContributionDecisionTrail:
      vi.fn().mockResolvedValue({
        stateHistory: [],
        evidence: [],
        reconciliationRuns: []
      })
  } as unknown as ProductQueryApi;
}

describe("product HTTP API", () => {
  it("routes repository overview", async () => {
    const queries = api();

    const result =
      await handleProductHttpRequest(
        request(
          "/api/repositories/100"
        ),
        queries
      );

    expect(result.statusCode).toBe(200);
    expect(
      queries.getRepositoryOverview
    ).toHaveBeenCalledWith(100);
  });

  it("routes the attention queue with filters and pagination", async () => {
    const queries = api();

    const result =
      await handleProductHttpRequest(
        request(
          "/api/repositories/100/attention?page=2&pageSize=10&nextActor=MAINTAINER&readiness=READY_TO_MERGE"
        ),
        queries
      );

    expect(result.statusCode).toBe(200);
    expect(
      queries.getMaintainerAttentionQueue
    ).toHaveBeenCalledWith(
      100,
      {
        page: 2,
        pageSize: 10,
        filters: {
          readiness:
            "READY_TO_MERGE",
          nextActor:
            "MAINTAINER"
        }
      }
    );
  });

  it("routes contribution detail", async () => {
    const queries = api();

    const result =
      await handleProductHttpRequest(
        request(
          "/api/repositories/100/contributions/42"
        ),
        queries
      );

    expect(result.statusCode).toBe(200);
    expect(
      queries.getContributionDetail
    ).toHaveBeenCalledWith({
      githubRepositoryId: 100,
      pullRequestNumber: 42
    });
  });

  it("routes the decision trail with a bounded limit", async () => {
    const queries = api();

    const result =
      await handleProductHttpRequest(
        request(
          "/api/repositories/100/contributions/42/decision-trail?limit=50"
        ),
        queries
      );

    expect(result.statusCode).toBe(200);
    expect(
      queries.getContributionDecisionTrail
    ).toHaveBeenCalledWith(
      {
        githubRepositoryId: 100,
        pullRequestNumber: 42
      },
      50
    );
  });

  it("rejects invalid identifiers and pagination", async () => {
    const queries = api();

    const badRepository =
      await handleProductHttpRequest(
        request(
          "/api/repositories/nope"
        ),
        queries
      );

    const badPageSize =
      await handleProductHttpRequest(
        request(
          "/api/repositories/100/attention?pageSize=101"
        ),
        queries
      );

    expect(
      badRepository.statusCode
    ).toBe(400);
    expect(
      badPageSize.statusCode
    ).toBe(400);
  });

  it("returns not found when the query layer has no matching resource", async () => {
    const queries = api();

    vi.mocked(
      queries.getContributionDetail
    ).mockResolvedValue(null);

    const result =
      await handleProductHttpRequest(
        request(
          "/api/repositories/100/contributions/999"
        ),
        queries
      );

    expect(result.statusCode).toBe(404);
  });
});

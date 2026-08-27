import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  ApiError,
  contribOSApi
} from "../src/api/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ContribOS API client", () => {
  it("requests a repository overview", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            repository: {
              id: "repo-1"
            },
            contributionCount: 0,
            contributions: []
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json"
            }
          }
        )
      );

    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    const result =
      await contribOSApi
        .repositoryOverview(100);

    expect(
      fetchMock
    ).toHaveBeenCalledWith(
      "/api/repositories/100",
      expect.objectContaining({
        method: "GET"
      })
    );

    expect(
      result.contributionCount
    ).toBe(0);
  });

  it("builds attention queue query parameters", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [],
            page: 2,
            pageSize: 10,
            total: 0,
            totalPages: 0
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    await contribOSApi.attentionQueue(
      100,
      {
        page: 2,
        pageSize: 10,
        nextActor: "MAINTAINER"
      }
    );

    expect(
      fetchMock
    ).toHaveBeenCalledWith(
      "/api/repositories/100/attention?page=2&pageSize=10&nextActor=MAINTAINER",
      expect.any(Object)
    );
  });

  it("surfaces API reason codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "ERROR",
            reasonCode:
              "INVALID_REPOSITORY_ID"
          }),
          {
            status: 400,
            headers: {
              "content-type":
                "application/json"
            }
          }
        )
      )
    );

    await expect(
      contribOSApi
        .repositoryOverview(100)
    ).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        statusCode: 400,
        reasonCode:
          "INVALID_REPOSITORY_ID"
      } satisfies Partial<ApiError>)
    );
  });
});

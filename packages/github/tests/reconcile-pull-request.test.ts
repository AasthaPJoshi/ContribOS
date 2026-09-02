import { describe, expect, it } from "vitest";

import { GitHubApiError } from "../src/github-api-client.js";

import {
  GitHubReconciliationError,
  reconcilePullRequest,
  type GitHubApiRequester
} from "../src/reconcile-pull-request.js";

interface FakeCall {
  path: string;
}

function createClient(
  handler: (path: string, callNumber: number) => unknown
): {
  client: GitHubApiRequester;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];
  let callNumber = 0;

  return {
    calls,
    client: {
      async request<T>(
        _installationId: number,
        path: string
      ): Promise<T> {
        callNumber += 1;
        calls.push({ path });
        return handler(path, callNumber) as T;
      }
    }
  };
}

function pullRequest(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 9001,
    html_url:
      "https://github.com/example/contribos/pull/42",
    state: "open",
    draft: false,
    merged: false,
    mergeable: true,
    updated_at: "2026-08-25T20:00:00.000Z",
    head: {
      sha: "abc123"
    },
    base: {
      ref: "main"
    },
    ...overrides
  };
}

const input = {
  installationId: 777,
  repositoryId: 1001,
  owner: "example",
  repository: "contribos",
  pullRequestNumber: 42
};

function defaultHandler(path: string): unknown {
  if (
    path ===
    "/repos/example/contribos/pulls/42"
  ) {
    return pullRequest();
  }

  if (
    path.startsWith(
      "/repos/example/contribos/rules/branches/main"
    )
  ) {
    return [
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_last_push_approval: false,
          require_code_owner_review: false,
          required_review_thread_resolution: false
        }
      },
      {
        type: "required_status_checks",
        parameters: {
          required_status_checks: [
            {
              context: "build",
              integration_id: 123
            }
          ]
        }
      }
    ];
  }

  if (
    path.startsWith(
      "/repos/example/contribos/pulls/42/reviews"
    )
  ) {
    return [
      {
        id: 5001,
        state: "APPROVED",
        commit_id: "abc123",
        submitted_at:
          "2026-08-25T20:01:00.000Z",
        html_url:
          "https://github.com/example/contribos/pull/42#pullrequestreview-5001",
        user: {
          login: "maintainer"
        }
      }
    ];
  }

  if (
    path.startsWith(
      "/repos/example/contribos/commits/abc123/check-runs"
    )
  ) {
    return {
      check_runs: [
        {
          id: 6001,
          name: "build",
          app: {
            id: 123
          },
          status: "completed",
          conclusion: "success",
          completed_at:
            "2026-08-25T20:02:00.000Z",
          html_url:
            "https://github.com/example/contribos/runs/6001"
        }
      ]
    };
  }

  if (
    path.startsWith(
      "/repos/example/contribos/commits/abc123/statuses"
    )
  ) {
    return [];
  }

  throw new Error(`Unexpected path: ${path}`);
}

describe("reconcilePullRequest hardened", () => {
  it("builds a policy-aware authoritative snapshot", async () => {
    const { client } = createClient(defaultHandler);

    const result = await reconcilePullRequest(
      client,
      input,
      {
        clock: () =>
          new Date("2026-08-25T20:03:00.000Z"),
        sleep: async () => {}
      }
    );

    expect(result.status).toBe("READY");
    expect(result.record).toMatchObject({
      checkStatus: "SUCCESS",
      reviewDecision: "APPROVED",
      headSha: "abc123"
    });

    expect(result.policy).toMatchObject({
      requiredApprovingReviewCount: 1,
      dismissStaleReviewsOnPush: true
    });

    expect(result.repairDecision).toEqual({
      action: "REPLACE_WITH_AUTHORITATIVE",
      reasonCode: "AUTHORITATIVE_BASELINE"
    });
  });


  it("marks CI as NOT_REQUIRED when policy is available and no checks are required", async () => {
    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        return pullRequest();
      }

      if (
        path.startsWith(
          "/repos/example/contribos/rules/branches/main"
        )
      ) {
        return [];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/pulls/42/reviews"
        )
      ) {
        return [];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/check-runs"
        )
      ) {
        return {
          check_runs: []
        };
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/statuses"
        )
      ) {
        return [];
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result.policy?.policyAvailability).toBe(
      "AVAILABLE"
    );
    expect(result.record?.checkStatus).toBe(
      "NOT_REQUIRED"
    );
  });


  it("keeps CI UNKNOWN when branch policy is unavailable", async () => {
    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        return pullRequest();
      }

      if (
        path.startsWith(
          "/repos/example/contribos/rules/branches/main"
        )
      ) {
        throw new GitHubApiError(
          "GitHub API request failed with HTTP 403.",
          403,
          "GITHUB_API_ERROR",
          "Upgrade to GitHub Pro or make this repository public to enable this feature."
        );
      }

      if (
        path.startsWith(
          "/repos/example/contribos/pulls/42/reviews"
        )
      ) {
        return [];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/check-runs"
        )
      ) {
        return {
          check_runs: []
        };
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/statuses"
        )
      ) {
        return [];
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result.policy?.policyAvailability).toBe(
      "UNAVAILABLE"
    );
    expect(result.record?.checkStatus).toBe(
      "UNKNOWN"
    );
  });

  it("uses a required legacy commit status when no check run matches", async () => {
    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        return pullRequest();
      }

      if (
        path.startsWith(
          "/repos/example/contribos/rules/branches/main"
        )
      ) {
        return [
          {
            type: "required_status_checks",
            parameters: {
              required_status_checks: [
                {
                  context: "legacy-ci"
                }
              ]
            }
          }
        ];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/pulls/42/reviews"
        )
      ) {
        return [];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/check-runs"
        )
      ) {
        return {
          check_runs: []
        };
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/statuses"
        )
      ) {
        return [
          {
            id: 7001,
            context: "legacy-ci",
            state: "success",
            updated_at:
              "2026-08-25T20:02:00.000Z"
          }
        ];
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result.record?.checkStatus).toBe(
      "SUCCESS"
    );
  });

  it("fails closed when a required status check is missing", async () => {
    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        return pullRequest();
      }

      if (
        path.startsWith(
          "/repos/example/contribos/rules/branches/main"
        )
      ) {
        return [
          {
            type: "required_status_checks",
            parameters: {
              required_status_checks: [
                {
                  context: "missing-ci"
                }
              ]
            }
          }
        ];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/pulls/42/reviews"
        )
      ) {
        return [];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/check-runs"
        )
      ) {
        return {
          check_runs: []
        };
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/statuses"
        )
      ) {
        return [];
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result.record?.checkStatus).toBe(
      "PENDING"
    );
  });

  it("ignores stale approvals when branch policy dismisses them", async () => {
    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        return pullRequest();
      }

      if (
        path.startsWith(
          "/repos/example/contribos/rules/branches/main"
        )
      ) {
        return [
          {
            type: "pull_request",
            parameters: {
              required_approving_review_count: 1,
              dismiss_stale_reviews_on_push: true
            }
          }
        ];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/pulls/42/reviews"
        )
      ) {
        return [
          {
            id: 5001,
            state: "APPROVED",
            commit_id: "old-sha",
            submitted_at:
              "2026-08-25T19:00:00.000Z",
            user: {
              login: "maintainer"
            }
          }
        ];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/check-runs"
        )
      ) {
        return {
          check_runs: []
        };
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/statuses"
        )
      ) {
        return [];
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result.record?.reviewDecision).toBe(
      "REVIEW_REQUIRED"
    );
  });

  it("retries mergeability with bounded backoff", async () => {
    let pullReads = 0;
    const delays: number[] = [];

    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        pullReads += 1;

        return pullRequest({
          mergeable:
            pullReads < 3 ? null : true
        });
      }

      return defaultHandler(path);
    });

    const result = await reconcilePullRequest(
      client,
      input,
      {
        sleep: async (delay) => {
          delays.push(delay);
        }
      }
    );

    expect(result.status).toBe("READY");
    expect(delays).toEqual([250, 500]);
  });

  it("defers repair if the PR head changes during reconciliation", async () => {
    let pullReads = 0;

    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        pullReads += 1;

        return pullRequest({
          head: {
            sha:
              pullReads === 1
                ? "abc123"
                : "def456"
          }
        });
      }

      return defaultHandler(path);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result).toMatchObject({
      status: "RETRY_REQUIRED",
      reasonCode: "HEAD_SHA_CHANGED",
      headSha: "def456",
      repairDecision: {
        action: "DEFER"
      }
    });
  });

  it("reports drift against webhook-derived state", async () => {
    const { client } = createClient(defaultHandler);

    const result = await reconcilePullRequest(
      client,
      {
        ...input,
        observedSnapshot: {
          evidence: [],
          isDraft: false,
          isOpen: true,
          isMerged: false,
          hasMergeConflict: false,
          checkStatus: "PENDING",
          reviewDecision: "APPROVED",
          authorHasChangesToMake: false,
          maintainerReviewRequired: false
        }
      }
    );

    expect(result.drift).toEqual({
      changed: true,
      fields: ["checkStatus"]
    });

    expect(result.repairDecision).toEqual({
      action: "REPLACE_WITH_AUTHORITATIVE",
      reasonCode: "AUTHORITATIVE_DRIFT_DETECTED"
    });
  });

  it("fails closed for review policies that need evidence not yet modeled", async () => {
    const { client } = createClient((path) => {
      if (
        path ===
        "/repos/example/contribos/pulls/42"
      ) {
        return pullRequest();
      }

      if (
        path.startsWith(
          "/repos/example/contribos/rules/branches/main"
        )
      ) {
        return [
          {
            type: "pull_request",
            parameters: {
              required_approving_review_count: 1,
              require_code_owner_review: true
            }
          }
        ];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/pulls/42/reviews"
        )
      ) {
        return [];
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/check-runs"
        )
      ) {
        return {
          check_runs: []
        };
      }

      if (
        path.startsWith(
          "/repos/example/contribos/commits/abc123/statuses"
        )
      ) {
        return [];
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await reconcilePullRequest(
      client,
      input
    );

    expect(result.status).toBe(
      "POLICY_UNRESOLVED"
    );
    expect(result.record?.reviewDecision).toBe(
      "UNKNOWN"
    );
    expect(result.repairDecision.action).toBe(
      "DEFER"
    );
  });

  it("rejects invalid reconciliation input before calling GitHub", async () => {
    const { client, calls } = createClient(() => {
      throw new Error("GitHub should not be called.");
    });

    await expect(
      reconcilePullRequest(client, {
        ...input,
        pullRequestNumber: 0
      })
    ).rejects.toBeInstanceOf(
      GitHubReconciliationError
    );

    expect(calls).toHaveLength(0);
  });
});

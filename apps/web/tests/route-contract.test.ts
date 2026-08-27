import {
  describe,
  expect,
  it
} from "vitest";

import {
  contribOSApi
} from "../src/api/client.js";

describe(
  "ContribOS product API route contract",
  () => {
    it("targets the repository dashboard route", async () => {
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async (
        input
      ) => {
        expect(String(input)).toBe(
          "/api/repositories/42/dashboard"
        );

        return new Response(
          JSON.stringify({
            repository: {},
            totals: {},
            byWorkflowState: {},
            byReadiness: {},
            byNextActor: {},
            highestPullRequestNumber: null,
            oldestUnreconciledAt: null
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json"
            }
          }
        );
      };

      try {
        await contribOSApi
          .repositoryDashboard(42);
      } finally {
        globalThis.fetch =
          originalFetch;
      }
    });

    it("targets contribution detail and safe decision trail routes", async () => {
      const originalFetch = globalThis.fetch;
      const requests: string[] = [];

      globalThis.fetch = async (
        input
      ) => {
        requests.push(String(input));

        return new Response(
          JSON.stringify(
            requests.length === 1
              ? {
                  repository: {},
                  contribution: {},
                  currentState: null
                }
              : {
                  stateHistory: [],
                  evidence: [],
                  reconciliationRuns: []
                }
          ),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json"
            }
          }
        );
      };

      try {
        await contribOSApi
          .contributionDetail(
            42,
            7
          );

        await contribOSApi
          .contributionDecisionTrail(
            42,
            7,
            100
          );
      } finally {
        globalThis.fetch =
          originalFetch;
      }

      expect(requests).toEqual([
        "/api/repositories/42/contributions/7",
        "/api/repositories/42/contributions/7/decision-trail?limit=100"
      ]);
    });
  }
);

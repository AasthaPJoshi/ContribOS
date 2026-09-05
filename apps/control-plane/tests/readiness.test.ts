import {
  describe,
  expect,
  it
} from "vitest";

import {
  evaluateReadinessChecks,
  readinessChecksPassed
} from "../src/readiness.js";

describe("readiness checks", () => {
  it("reports all healthy dependencies as ready", async () => {
    const results = await evaluateReadinessChecks({
      database: async () => ({ ready: true })
    });

    expect(readinessChecksPassed(results)).toBe(true);
    expect(results.database).toEqual({ ready: true });
  });

  it("times out a stalled dependency check", async () => {
    const results =
      await evaluateReadinessChecks(
        {
          database: () =>
            new Promise(() => {})
        },
        5
      );

    expect(
      readinessChecksPassed(results)
    ).toBe(false);

    expect(results.database).toEqual({
      ready: false,
      reasonCode:
        "READINESS_CHECK_TIMEOUT"
    });
  });

  it("fails closed when a dependency check throws", async () => {
    const results = await evaluateReadinessChecks({
      database: async () => {
        throw new Error("secret backend detail");
      }
    });

    expect(readinessChecksPassed(results)).toBe(false);
    expect(results.database).toEqual({
      ready: false,
      reasonCode: "READINESS_CHECK_FAILED"
    });
  });
});

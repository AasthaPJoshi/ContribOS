import {
  describe,
  expect,
  it
} from "vitest";

import {
  RequestMetrics,
  resolveRequestId
} from "../src/request-observability.js";

describe("request observability", () => {
  it("preserves a safe caller request id", () => {
    expect(
      resolveRequestId("request-123")
    ).toBe("request-123");
  });

  it("replaces unsafe request ids", () => {
    const value = resolveRequestId(
      "bad request id with spaces"
    );

    expect(value).not.toBe(
      "bad request id with spaces"
    );
    expect(value.length).toBeGreaterThan(0);
  });

  it("tracks request lifecycle counters", () => {
    const metrics = new RequestMetrics();

    metrics.begin();
    metrics.begin();
    metrics.finish(200);
    metrics.finish(503);

    expect(metrics.snapshot()).toEqual({
      totalRequests: 2,
      activeRequests: 0,
      failedRequests: 1
    });
  });
});

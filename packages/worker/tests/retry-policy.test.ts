import {
  describe,
  expect,
  it
} from "vitest";

import {
  getWorkerRetryDelayMs
} from "../src/retry-policy.js";

describe("getWorkerRetryDelayMs", () => {
  it("uses capped exponential backoff", () => {
    expect(
      getWorkerRetryDelayMs(1)
    ).toBe(1000);

    expect(
      getWorkerRetryDelayMs(2)
    ).toBe(2000);

    expect(
      getWorkerRetryDelayMs(10)
    ).toBe(60000);
  });
});

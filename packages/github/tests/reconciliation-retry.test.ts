import { describe, expect, it } from "vitest";

import { getReconciliationRetryDelayMs } from "../src/reconciliation-retry.js";

describe("getReconciliationRetryDelayMs", () => {
  it("uses capped exponential backoff", () => {
    expect(getReconciliationRetryDelayMs(1)).toBe(250);
    expect(getReconciliationRetryDelayMs(2)).toBe(500);
    expect(getReconciliationRetryDelayMs(3)).toBe(1000);
    expect(
      getReconciliationRetryDelayMs(10)
    ).toBe(5000);
  });
});

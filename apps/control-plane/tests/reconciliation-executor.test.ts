import { describe, expect, it } from "vitest";
import { ReconciliationRetryError } from "../src/reconciliation-executor.js";

describe("ReconciliationRetryError", () => {
  it("preserves a machine-readable retry reason", () => {
    const error = new ReconciliationRetryError(
      "MERGEABILITY_PENDING",
      "MERGEABILITY_PENDING"
    );

    expect(error.code).toBe("MERGEABILITY_PENDING");
    expect(error.message).toBe("MERGEABILITY_PENDING");
  });
});

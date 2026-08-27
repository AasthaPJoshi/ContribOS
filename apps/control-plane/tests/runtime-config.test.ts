import {
  describe,
  expect,
  it
} from "vitest";

import {
  loadRuntimeConfig
} from "../src/runtime-config.js";

describe("loadRuntimeConfig", () => {
  it("uses safe defaults", () => {
    expect(
      loadRuntimeConfig({})
    ).toEqual({
      workerPollIntervalMs:
        1_000,
      reconciliationSweepIntervalMs:
        300_000
    });
  });

  it("rejects invalid positive integer settings", () => {
    expect(() =>
      loadRuntimeConfig({
        CONTRIBOS_WORKER_POLL_INTERVAL_MS:
          "0"
      })
    ).toThrow();
  });
});

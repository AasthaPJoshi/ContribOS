import {
  describe,
  expect,
  it
} from "vitest";

import {
  RuntimeHealth
} from "../src/health.js";

describe("RuntimeHealth", () => {
  it("moves from starting to ready to shutdown", () => {
    const health =
      new RuntimeHealth();

    expect(
      health.snapshot()
    ).toEqual({
      live: true,
      ready: false,
      shuttingDown: false
    });

    health.markReady();

    expect(
      health.snapshot().ready
    ).toBe(true);

    health.beginShutdown();

    expect(
      health.snapshot()
    ).toEqual({
      live: true,
      ready: false,
      shuttingDown: true
    });
  });
});

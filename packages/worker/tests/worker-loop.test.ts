import { describe, expect, it } from "vitest";

import { WorkerLoop } from "../src/worker-loop.js";

describe("WorkerLoop", () => {
  it("supports graceful stop while idle", async () => {
    let runs = 0;
    let loop: WorkerLoop;

    const runner = {
      async runOnce() {
        runs += 1;
        return { status: "IDLE" } as const;
      }
    };

    loop = new WorkerLoop(
      runner as never,
      {
        pollIntervalMs: 1,
        sleep: async () => {
          loop.requestStop();
        }
      }
    );

    await loop.run();
    expect(runs).toBe(1);
  });
});

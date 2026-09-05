import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  SweepScheduler
} from "../src/sweep-scheduler.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

describe("SweepScheduler", () => {
  it("prevents overlapping sweep runs", async () => {
    const gate = deferred<boolean>();
    const warn = vi.fn();

    const scheduler = new SweepScheduler(
      {} as never,
      {
        enqueue: vi.fn(
          async () => gate.promise
        )
      } as never,
      {
        info: vi.fn(),
        warn,
        error: vi.fn()
      },
      {
        intervalMs: 10,
        installations: {
          listAll: async () => [
            {
              id: "installation-1",
              githubInstallationId: "10",
              accountLogin: "example",
              accountType: "User",
              permissions: {},
              repositorySelection: "selected",
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        }
      }
    );

    const first = scheduler.runOnce();
    await Promise.resolve();

    await expect(
      scheduler.runOnce()
    ).resolves.toBe(0);

    expect(warn).toHaveBeenCalledWith(
      "sweep.skipped_overlap"
    );

    gate.resolve(true);

    await expect(first).resolves.toBe(1);
  });
});

import {
  describe,
  expect,
  it
} from "vitest";

import type {
  NormalizedGitHubWebhookEvent
} from "@contribos/github";
import {
  InMemoryJobStore
} from "@contribos/worker";

import {
  ApplicationRuntime
} from "../src/application-runtime.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

describe("ApplicationRuntime shutdown", () => {
  it("waits for an active worker job before shutdown completes", async () => {
    const store = new InMemoryJobStore();
    const started = deferred();
    const release = deferred();

    const runtime = new ApplicationRuntime({
      store,
      pullRequests: {
        async execute() {
          started.resolve();
          await release.promise;
        }
      },
      sweeps: {
        async execute() {}
      },
      logger: {
        info() {},
        warn() {},
        error() {}
      },
      workerPollIntervalMs: 1
    });

    const event:
      NormalizedGitHubWebhookEvent = {
        deliveryId: "delivery-shutdown",
        eventName: "pull_request",
        action: "synchronize",
        installationId: 10,
        repositoryId: 20,
        objectType: "PULL_REQUEST",
        objectId: "100",
        objectUrl:
          "https://example.test/pr/42",
        contributionNumber: 42,
        headSha: "abc123",
        occurredAt: new Date()
      };

    await runtime.webhooks
      .acceptNormalizedEvent(event);

    void runtime.startWorker();
    await started.promise;

    let stopped = false;
    const shutdown = runtime
      .stopAndWait()
      .then(() => {
        stopped = true;
      });

    await Promise.resolve();
    expect(stopped).toBe(false);

    release.resolve();
    await shutdown;

    expect(stopped).toBe(true);
    expect(
      runtime.health.snapshot()
    ).toMatchObject({
      ready: false,
      shuttingDown: true
    });
  });
});

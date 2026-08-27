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

describe(
  "ApplicationRuntime integration",
  () => {
    it("moves a normalized webhook through queue and worker execution", async () => {
      const store =
        new InMemoryJobStore();

      const executed:
        number[] = [];

      const runtime =
        new ApplicationRuntime({
          store,
          pullRequests: {
            async execute(payload) {
              executed.push(
                payload
                  .pullRequestNumber
              );
            }
          },
          sweeps: {
            async execute() {}
          },
          logger: {
            info() {},
            warn() {},
            error() {}
          }
        });

      const event:
        NormalizedGitHubWebhookEvent =
        {
          deliveryId:
            "delivery-1",
          eventName:
            "pull_request",
          action:
            "synchronize",
          installationId: 10,
          repositoryId: 20,
          objectType:
            "PULL_REQUEST",
          objectId: "100",
          objectUrl:
            "https://example.test/pr/42",
          contributionNumber: 42,
          headSha: "abc123",
          occurredAt:
            new Date(
              "2026-08-26T00:00:00Z"
            )
        };

      expect(
        await runtime.webhooks
          .acceptNormalizedEvent(
            event
          )
      ).toBe("ENQUEUED");

      expect(
        await runtime.runner
          .runOnce()
      ).toMatchObject({
        status: "COMPLETED"
      });

      expect(executed).toEqual([
        42
      ]);
    });

    it("routes scheduled sweep jobs through the same worker", async () => {
      const store =
        new InMemoryJobStore();

      const installations:
        number[] = [];

      const runtime =
        new ApplicationRuntime({
          store,
          pullRequests: {
            async execute() {}
          },
          sweeps: {
            async execute(payload) {
              installations.push(
                payload.installationId
              );
            }
          },
          logger: {
            info() {},
            warn() {},
            error() {}
          }
        });

      await runtime.sweepProducer
        .enqueue(
          {
            installationId: 10
          },
          new Date(
            "2026-08-26T00:00:00Z"
          )
        );

      expect(
        await runtime.runner
          .runOnce()
      ).toMatchObject({
        status: "COMPLETED"
      });

      expect(
        installations
      ).toEqual([10]);
    });
  }
);

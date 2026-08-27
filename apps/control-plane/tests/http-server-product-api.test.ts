import type {
  AddressInfo
} from "node:net";

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  createControlPlaneServer
} from "../src/http-server.js";

const servers:
  ReturnType<
    typeof createControlPlaneServer
  >[] = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>(
          (resolve) => {
            server.close(() =>
              resolve()
            );
          }
        )
    )
  );

  servers.length = 0;
});

function serverOptions() {
  return {
    health: {
      snapshot: () => ({
        live: true,
        ready: true,
        shuttingDown: false
      })
    } as never,
    webhook: {
      handle: vi.fn()
    } as never,
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
    productQueries: {
      getRepositoryOverview:
        vi.fn().mockResolvedValue({
          repository: {
            id: "repository-1",
            githubRepositoryId:
              "100"
          },
          contributionCount: 0,
          contributions: []
        }),
      getRepositoryDashboard:
        vi.fn(),
      getMaintainerAttentionQueue:
        vi.fn(),
      getContributionDetail:
        vi.fn(),
      getContributionDecisionTrail:
        vi.fn()
    } as never
  };
}

async function startServer() {
  const server =
    createControlPlaneServer(
      serverOptions()
    );

  servers.push(server);

  await new Promise<void>(
    (resolve) => {
      server.listen(
        0,
        "127.0.0.1",
        () => resolve()
      );
    }
  );

  return server;
}

describe(
  "control-plane product HTTP integration",
  () => {
    it("serves repository product queries over HTTP", async () => {
      const server =
        await startServer();

      const address =
        server.address() as AddressInfo;

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/repositories/100`
      );

      expect(response.status).toBe(200);

      const body =
        await response.json() as {
          contributionCount: number;
        };

      expect(
        body.contributionCount
      ).toBe(0);
    });

    it("returns a JSON 400 for invalid product API input", async () => {
      const server =
        await startServer();

      const address =
        server.address() as AddressInfo;

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/repositories/not-a-number`
      );

      expect(response.status).toBe(400);

      const body =
        await response.json() as {
          reasonCode: string;
        };

      expect(
        body.reasonCode
      ).toBe(
        "INVALID_REPOSITORY_ID"
      );
    });
  }
);

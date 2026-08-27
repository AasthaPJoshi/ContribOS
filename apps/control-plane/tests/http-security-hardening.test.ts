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

const SESSION_TOKEN =
  "A".repeat(43);

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
            server.close(
              () => resolve()
            );
          }
        )
    )
  );

  servers.length = 0;
});

function options(
  authorizationResult:
    unknown = {
      allowed: false,
      reason:
        "REPOSITORY_NOT_AUTHORIZED"
    }
) {
  const webhookHandle =
    vi.fn()
      .mockResolvedValue({
        statusCode: 202,
        body: {
          status: "OK"
        }
      });

  return {
    webhookHandle,
    health: {
      snapshot: () => ({
        live: true,
        ready: true,
        shuttingDown: false
      })
    } as never,
    webhook: {
      handle:
        webhookHandle
    } as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    },
    productQueries: {
      getRepositoryOverview:
        vi.fn(),
      getRepositoryDashboard:
        vi.fn(),
      getMaintainerAttentionQueue:
        vi.fn(),
      getContributionDetail:
        vi.fn(),
      getContributionDecisionTrail:
        vi.fn()
    } as never,
    auth: {
      beginLogin:
        vi.fn(),
      completeLogin:
        vi.fn(),
      resolveSessionContext:
        vi.fn()
          .mockResolvedValue({
            sessionId:
              "session-1",
            userId:
              "user-1",
            principal: {
              provider:
                "GITHUB",
              providerUserId:
                "42",
              login:
                "octocat"
            },
            githubAccessTokenCiphertext:
              "encrypted",
            githubAccessTokenExpiresAt:
              null
          }),
      signOut:
        vi.fn()
    } as never,
    repositoryAuthorization: {
      authorize:
        vi.fn()
          .mockResolvedValue(
            authorizationResult
          )
    } as never,
    publicOrigin:
      "http://localhost:5173"
  };
}

async function start(
  authorizationResult?:
    unknown
) {
  const server =
    createControlPlaneServer(
      options(
        authorizationResult
      )
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
  "HTTP security hardening",
  () => {
    it("hides repository existence when the user is not authorized", async () => {
      const server =
        await start();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`,
          {
            headers: {
              cookie:
                `contribos_session=${SESSION_TOKEN}`
            }
          }
        );

      expect(
        response.status
      ).toBe(404);

      await expect(
        response.json()
      ).resolves.toEqual({
        status:
          "NOT_FOUND"
      });
    });

    it("rejects webhook bodies without JSON content type before dispatch", async () => {
      const localOptions =
        options();

      const server =
        createControlPlaneServer(
          localOptions
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

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/webhooks/github`,
          {
            method: "POST",
            headers: {
              "content-type":
                "text/plain"
            },
            body: "{}"
          }
        );

      expect(
        response.status
      ).toBe(415);

      expect(
        localOptions
          .webhookHandle
      ).not.toHaveBeenCalled();
    });

    it("sends baseline security headers on API responses", async () => {
      const server =
        await start();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`,
          {
            headers: {
              cookie:
                `contribos_session=${SESSION_TOKEN}`
            }
          }
        );

      expect(
        response.headers.get(
          "cache-control"
        )
      ).toBe("no-store");

      expect(
        response.headers.get(
          "x-content-type-options"
        )
      ).toBe("nosniff");

      expect(
        response.headers.get(
          "x-frame-options"
        )
      ).toBe("DENY");
    });
  }
);

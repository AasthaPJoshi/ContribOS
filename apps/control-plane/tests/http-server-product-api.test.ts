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

const AUTH_CONTEXT = {
  sessionId:
    "session-1",
  userId:
    "user-1",
  principal: {
    provider: "GITHUB",
    providerUserId: "42",
    login: "octocat"
  },
  githubAccessTokenCiphertext:
    "encrypted",
  githubAccessTokenExpiresAt:
    null
} as const;

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
      warn: vi.fn()
    },
    productQueries: {
      getRepositoryOverview:
        vi.fn()
          .mockResolvedValue({
            repository: {
              id:
                "repository-1",
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
    } as never,
    auth: {
      beginLogin:
        vi.fn()
          .mockResolvedValue({
            authorizationUrl:
              "https://github.com/login/oauth/authorize?state=abc",
            stateCookie:
              "contribos_oauth_state=abc; HttpOnly"
          }),
      completeLogin:
        vi.fn()
          .mockResolvedValue({
            principal:
              AUTH_CONTEXT.principal,
            sessionCookie:
              "contribos_session=session; HttpOnly",
            clearStateCookie:
              "contribos_oauth_state=; Max-Age=0"
          }),
      resolveSessionContext:
        vi.fn(
          async (
            rawToken: string
          ) =>
            rawToken ===
            SESSION_TOKEN
              ? AUTH_CONTEXT
              : null
        ),
      signOut:
        vi.fn()
          .mockResolvedValue(
            "contribos_session=; Max-Age=0"
          )
    },
    repositoryAuthorization: {
      authorize:
        vi.fn()
          .mockResolvedValue({
            allowed: true,
            accessLevel: "READ",
            repository: {
              repositoryId:
                "repository-1",
              githubRepositoryId:
                "100",
              repositoryFullName:
                "owner/repo",
              isPrivate: true,
              installationId:
                "installation-1",
              githubInstallationId:
                "99"
            }
          })
    } as never,
    publicOrigin:
      "http://localhost:5173"
  };
}

async function startServer(
  overrides: Partial<
    ReturnType<
      typeof serverOptions
    >
  > = {}
) {
  const options = {
    ...serverOptions(),
    ...overrides
  };

  const server =
    createControlPlaneServer(
      options
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

  return {
    server,
    options
  };
}

function cookieHeaders() {
  return {
    cookie:
      `contribos_session=${SESSION_TOKEN}`
  };
}

describe(
  "control-plane authenticated product HTTP integration",
  () => {
    it("rejects anonymous product API requests", async () => {
      const { server } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`
        );

      expect(
        response.status
      ).toBe(401);

      await expect(
        response.json()
      ).resolves.toMatchObject({
        reasonCode:
          "UNAUTHENTICATED"
      });
    });

    it("serves an authorized repository query", async () => {
      const { server } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`,
          {
            headers:
              cookieHeaders()
          }
        );

      expect(
        response.status
      ).toBe(200);

      const body =
        await response.json() as {
          contributionCount:
            number;
        };

      expect(
        body.contributionCount
      ).toBe(0);
    });

    it("returns 404 when repository authorization fails to avoid existence leakage", async () => {
      const {
        server
      } = await startServer({
        repositoryAuthorization: {
          authorize:
            vi.fn()
              .mockResolvedValue({
                allowed: false,
                reason:
                  "REPOSITORY_NOT_AUTHORIZED"
              })
        } as never
      });

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/100`,
          {
            headers:
              cookieHeaders()
          }
        );

      expect(
        response.status
      ).toBe(404);
    });

    it("preserves product validation after authentication", async () => {
      const { server } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/repositories/not-a-number`,
          {
            headers:
              cookieHeaders()
          }
        );

      expect(
        response.status
      ).toBe(400);

      await expect(
        response.json()
      ).resolves.toMatchObject({
        reasonCode:
          "INVALID_REPOSITORY_ID"
      });
    });

    it("returns the authenticated current user without exposing credentials", async () => {
      const { server } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/api/auth/me`,
          {
            headers:
              cookieHeaders()
          }
        );

      expect(
        response.status
      ).toBe(200);

      await expect(
        response.json()
      ).resolves.toEqual({
        user: {
          provider:
            "GITHUB",
          providerUserId:
            "42",
          login:
            "octocat"
        }
      });
    });

    it("starts GitHub login with a state cookie", async () => {
      const { server } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/auth/github/login`,
          {
            redirect:
              "manual"
          }
        );

      expect(
        response.status
      ).toBe(302);

      expect(
        response.headers
          .get("location")
      ).toContain(
        "https://github.com/"
      );

      expect(
        response.headers
          .get("set-cookie")
      ).toContain(
        "contribos_oauth_state="
      );
    });

    it("rejects cross-origin logout", async () => {
      const { server } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/auth/logout`,
          {
            method: "POST",
            headers: {
              ...cookieHeaders(),
              origin:
                "https://attacker.example"
            }
          }
        );

      expect(
        response.status
      ).toBe(403);
    });

    it("revokes a session on same-origin logout", async () => {
      const {
        server,
        options
      } =
        await startServer();

      const address =
        server.address() as
          AddressInfo;

      const response =
        await fetch(
          `http://127.0.0.1:${address.port}/auth/logout`,
          {
            method: "POST",
            headers: {
              ...cookieHeaders(),
              origin:
                "http://localhost:5173"
            }
          }
        );

      expect(
        response.status
      ).toBe(204);

      expect(
        options.auth.signOut
      ).toHaveBeenCalledWith(
        SESSION_TOKEN
      );
    });
  }
);

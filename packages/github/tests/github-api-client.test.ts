import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  GitHubApiClient,
  GitHubApiError
} from "../src/github-api-client.js";
import {
  GitHubAppAuth,
  GitHubInstallationTokenProvider
} from "../src/github-app-auth.js";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

function createTokenProvider(options?: {
  repositorySelection?: "all" | "selected";
  repositoryIds?: number[];
  permissions?: Record<string, string>;
  onTokenRequest?: () => void;
}): GitHubInstallationTokenProvider {
  const auth = new GitHubAppAuth({
    appId: 12345,
    privateKey,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    fetchImpl: async () => {
      options?.onTokenRequest?.();

      return {
        ok: true,
        status: 201,
        async json() {
          return {
            token: "installation-token",
            expires_at: "2026-08-25T13:00:00.000Z",
            permissions: options?.permissions ?? {
              contents: "read",
              pull_requests: "read"
            },
            repository_selection:
              options?.repositorySelection ?? "selected",
            repositories: (options?.repositoryIds ?? [42]).map((id) => ({
              id
            }))
          };
        },
        async text() {
          return "";
        }
      };
    }
  });

  return new GitHubInstallationTokenProvider({
    auth,
    clock: () => new Date("2026-08-25T12:00:00.000Z")
  });
}

describe("GitHubApiClient", () => {
  it("authenticates GitHub API requests with an installation token", async () => {
    let authorizationHeader = "";

    const client = new GitHubApiClient({
      tokenProvider: createTokenProvider(),
      fetchImpl: async (_url, init) => {
        authorizationHeader = init?.headers?.["Authorization"] ?? "";

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: 42,
              name: "contribos"
            };
          },
          async text() {
            return "";
          }
        };
      }
    });

    const repository = await client.request<{
      id: number;
      name: string;
    }>(777, "/repos/example/contribos", {
      repositoryId: 42,
      requiredPermissions: [
        {
          permission: "contents",
          level: "read"
        }
      ]
    });

    expect(authorizationHeader).toBe("Bearer installation-token");
    expect(repository).toEqual({
      id: 42,
      name: "contribos"
    });
  });

  it("rejects insufficient installation permissions before API access", async () => {
    let apiRequests = 0;

    const client = new GitHubApiClient({
      tokenProvider: createTokenProvider({
        permissions: {
          contents: "read"
        }
      }),
      fetchImpl: async () => {
        apiRequests += 1;
        throw new Error("API should not be called.");
      }
    });

    await expect(
      client.request(777, "/repos/example/contribos", {
        requiredPermissions: [
          {
            permission: "pull_requests",
            level: "write"
          }
        ]
      })
    ).rejects.toMatchObject({
      reasonCode: "INSUFFICIENT_INSTALLATION_PERMISSIONS",
      status: 403
    });

    expect(apiRequests).toBe(0);
  });

  it("rejects a repository outside the installation token scope", async () => {
    const client = new GitHubApiClient({
      tokenProvider: createTokenProvider({
        repositorySelection: "selected",
        repositoryIds: [42]
      })
    });

    await expect(
      client.request(777, "/repos/example/other", {
        repositoryId: 99
      })
    ).rejects.toMatchObject({
      reasonCode: "REPOSITORY_OUT_OF_SCOPE",
      status: 403
    });
  });

  it("retries once with a refreshed token after HTTP 401", async () => {
    let tokenRequests = 0;
    let apiRequests = 0;

    const client = new GitHubApiClient({
      tokenProvider: createTokenProvider({
        repositorySelection: "all",
        onTokenRequest: () => {
          tokenRequests += 1;
        }
      }),
      fetchImpl: async () => {
        apiRequests += 1;

        if (apiRequests === 1) {
          return {
            ok: false,
            status: 401,
            async json() {
              return {
                message: "Bad credentials"
              };
            },
            async text() {
              return "Bad credentials";
            }
          };
        }

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true
            };
          },
          async text() {
            return "";
          }
        };
      }
    });

    const response = await client.request<{ ok: boolean }>(
      777,
      "/repos/example/contribos",
      {
        repositoryId: 42
      }
    );

    expect(response).toEqual({
      ok: true
    });
    expect(apiRequests).toBe(2);
    expect(tokenRequests).toBe(2);
  });

  it("does not retry non-authentication failures", async () => {
    let apiRequests = 0;

    const client = new GitHubApiClient({
      tokenProvider: createTokenProvider({
        repositorySelection: "all"
      }),
      fetchImpl: async () => {
        apiRequests += 1;

        return {
          ok: false,
          status: 403,
          async json() {
            return {
              message: "Forbidden"
            };
          },
          async text() {
            return "Forbidden";
          }
        };
      }
    });

    await expect(
      client.request(777, "/repos/example/contribos")
    ).rejects.toBeInstanceOf(GitHubApiError);

    expect(apiRequests).toBe(1);
  });

  it("rejects invalid installation IDs and unsafe API paths", async () => {
    const client = new GitHubApiClient({
      tokenProvider: createTokenProvider()
    });

    await expect(
      client.request(0, "/repos/example/contribos")
    ).rejects.toMatchObject({
      reasonCode: "INVALID_INSTALLATION_ID"
    });

    await expect(
      client.request(777, "//evil.example/path")
    ).rejects.toMatchObject({
      reasonCode: "INVALID_API_PATH"
    });

    await expect(
      client.request(777, "repos/example/contribos")
    ).rejects.toMatchObject({
      reasonCode: "INVALID_API_PATH"
    });
  });
});

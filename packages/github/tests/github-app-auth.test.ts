import {
  createVerify,
  generateKeyPairSync
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  GitHubAppAuth,
  GitHubAuthError,
  GitHubInstallationTokenProvider
} from "../src/github-app-auth.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

function installationTokenResponse(
  token = "installation-token",
  expiresAt = "2026-08-25T13:00:00.000Z"
) {
  return {
    token,
    expires_at: expiresAt,
    permissions: {
      contents: "read",
      pull_requests: "read"
    },
    repository_selection: "selected",
    repositories: [
      {
        id: 1001
      }
    ]
  };
}

describe("GitHubAppAuth", () => {
  it("creates a valid RS256 GitHub App JWT", () => {
    const now = new Date("2026-08-25T12:00:00.000Z");

    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      clock: () => now
    });

    const jwt = auth.createAppJwt();
    const parts = jwt.split(".");

    expect(parts).toHaveLength(3);

    const header = JSON.parse(
      Buffer.from(parts[0]!, "base64url").toString("utf8")
    ) as Record<string, unknown>;

    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8")
    ) as Record<string, unknown>;

    expect(header).toEqual({
      alg: "RS256",
      typ: "JWT"
    });

    expect(payload["iss"]).toBe("12345");

    const nowSeconds = Math.floor(now.getTime() / 1000);

    expect(payload["iat"]).toBe(nowSeconds - 60);
    expect(payload["exp"]).toBe(nowSeconds + 9 * 60);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    expect(
      verifier.verify(
        publicKey,
        Buffer.from(parts[2]!, "base64url")
      )
    ).toBe(true);
  });

  it("exchanges an app JWT for a scoped installation token", async () => {
    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      clock: () => new Date("2026-08-25T12:00:00.000Z"),
      fetchImpl: async () => ({
        ok: true,
        status: 201,
        async json() {
          return installationTokenResponse();
        },
        async text() {
          return "";
        }
      })
    });

    const token = await auth.createInstallationToken(777);

    expect(token.repositorySelection).toBe("selected");
    expect(token.repositoryIds).toEqual([1001]);
    expect(token.permissions).toEqual({
      contents: "read",
      pull_requests: "read"
    });
  });

  it("rejects an invalid installation ID", async () => {
    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey
    });

    await expect(auth.createInstallationToken(0)).rejects.toMatchObject({
      reasonCode: "INVALID_INSTALLATION_ID"
    });
  });

  it("rejects malformed installation token responses", async () => {
    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      fetchImpl: async () => ({
        ok: true,
        status: 201,
        async json() {
          return {
            expires_at: "2026-08-25T13:00:00.000Z"
          };
        },
        async text() {
          return "";
        }
      })
    });

    await expect(
      auth.createInstallationToken(777)
    ).rejects.toBeInstanceOf(GitHubAuthError);
  });

  it("rejects malformed repository scope data", async () => {
    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      fetchImpl: async () => ({
        ok: true,
        status: 201,
        async json() {
          return {
            ...installationTokenResponse(),
            repositories: [
              {
                id: "not-a-number"
              }
            ]
          };
        },
        async text() {
          return "";
        }
      })
    });

    await expect(
      auth.createInstallationToken(777)
    ).rejects.toMatchObject({
      reasonCode: "INVALID_INSTALLATION_TOKEN_RESPONSE"
    });
  });
});

describe("GitHubInstallationTokenProvider", () => {
  it("caches a token while it is safely valid", async () => {
    let tokenRequests = 0;
    const now = new Date("2026-08-25T12:00:00.000Z");

    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      clock: () => now,
      fetchImpl: async () => {
        tokenRequests += 1;

        return {
          ok: true,
          status: 201,
          async json() {
            return installationTokenResponse(
              `installation-token-${tokenRequests}`
            );
          },
          async text() {
            return "";
          }
        };
      }
    });

    const provider = new GitHubInstallationTokenProvider({
      auth,
      clock: () => now
    });

    const first = await provider.getToken(777);
    const second = await provider.getToken(777);

    expect(first.token).toBe("installation-token-1");
    expect(second.token).toBe("installation-token-1");
    expect(tokenRequests).toBe(1);
  });

  it("refreshes a token near expiry", async () => {
    let tokenRequests = 0;
    let now = new Date("2026-08-25T12:00:00.000Z");

    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      clock: () => now,
      fetchImpl: async () => {
        tokenRequests += 1;

        return {
          ok: true,
          status: 201,
          async json() {
            return installationTokenResponse(
              `installation-token-${tokenRequests}`,
              tokenRequests === 1
                ? "2026-08-25T12:02:00.000Z"
                : "2026-08-25T13:00:00.000Z"
            );
          },
          async text() {
            return "";
          }
        };
      }
    });

    const provider = new GitHubInstallationTokenProvider({
      auth,
      refreshSkewMs: 60_000,
      clock: () => now
    });

    const first = await provider.getToken(777);

    now = new Date("2026-08-25T12:01:30.000Z");

    const second = await provider.getToken(777);

    expect(first.token).toBe("installation-token-1");
    expect(second.token).toBe("installation-token-2");
    expect(tokenRequests).toBe(2);
  });

  it("shares one refresh across concurrent requests", async () => {
    let tokenRequests = 0;
    const now = new Date("2026-08-25T12:00:00.000Z");

    const auth = new GitHubAppAuth({
      appId: 12345,
      privateKey,
      clock: () => now,
      fetchImpl: async () => {
        tokenRequests += 1;

        await new Promise((resolve) => setTimeout(resolve, 10));

        return {
          ok: true,
          status: 201,
          async json() {
            return installationTokenResponse(
              `installation-token-${tokenRequests}`
            );
          },
          async text() {
            return "";
          }
        };
      }
    });

    const provider = new GitHubInstallationTokenProvider({
      auth,
      clock: () => now
    });

    const tokens = await Promise.all([
      provider.getToken(777),
      provider.getToken(777),
      provider.getToken(777)
    ]);

    expect(tokens.map((token) => token.token)).toEqual([
      "installation-token-1",
      "installation-token-1",
      "installation-token-1"
    ]);
    expect(tokenRequests).toBe(1);
  });
});

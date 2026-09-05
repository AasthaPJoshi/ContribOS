import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  AuthSessionRow,
  AuthUserRow,
  UpdateGitHubUserCredentialsInput
} from "@contribos/db";

import {
  AuthService
} from "../src/security/auth-service.js";
import {
  decryptCredential,
  encryptCredential
} from "../src/security/credential-cipher.js";

const key = Buffer.alloc(32, 31)
  .toString("base64");

function userRow(): AuthUserRow {
  const now = new Date(
    "2026-09-02T00:00:00Z"
  );

  return {
    id: "00000000-0000-4000-8000-000000000001",
    provider: "GITHUB",
    providerUserId: "42",
    login: "octocat",
    avatarUrl: null,
    githubAccessTokenCiphertext:
      encryptCredential("ghu_old", key),
    githubAccessTokenExpiresAt:
      new Date(
        "2026-09-01T23:59:00Z"
      ),
    githubRefreshTokenCiphertext:
      encryptCredential("ghr_old", key),
    githubRefreshTokenExpiresAt:
      new Date(
        "2026-09-03T00:00:00Z"
      ),
    createdAt: now,
    updatedAt: now
  };
}

function sessionRow(): AuthSessionRow {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000001",
    tokenHash: "a".repeat(64),
    expiresAt:
      new Date(
        "2026-09-03T00:00:00Z"
      ),
    revokedAt: null,
    lastSeenAt:
      new Date(
        "2026-09-01T23:00:00Z"
      ),
    createdAt:
      new Date(
        "2026-09-01T23:00:00Z"
      ),
    updatedAt:
      new Date(
        "2026-09-01T23:00:00Z"
      )
  };
}

describe("AuthService refresh hardening", () => {
  it("refreshes expired GitHub credentials and throttles session last-seen writes", async () => {
    const oldUser = userRow();
    const touch = vi.fn(async () => {});
    const update = vi.fn(
      async (
        _id: string,
        input:
          UpdateGitHubUserCredentialsInput
      ): Promise<AuthUserRow> => ({
        ...oldUser,
        ...input,
        updatedAt:
          new Date(
            "2026-09-02T00:00:00Z"
          )
      })
    );

    const service = new AuthService({
      oauth: {
        refreshAccessToken:
          vi.fn(async () => ({
            accessToken: "ghu_new",
            accessTokenExpiresAt:
              new Date(
                "2026-09-02T01:00:00Z"
              ),
            refreshToken: "ghr_new",
            refreshTokenExpiresAt:
              new Date(
                "2026-09-03T01:00:00Z"
              )
          }))
      } as never,
      users: {
        upsertGitHubUser:
          vi.fn() as never,
        updateGitHubCredentials:
          update
      },
      sessions: {
        create: vi.fn() as never,
        findActiveByTokenHash:
          async () => ({
            session: sessionRow(),
            user: oldUser
          }),
        revokeByTokenHash:
          async () => true,
        touch
      },
      oauthStates: {} as never,
      credentialEncryptionKey: key,
      secureCookies: false,
      sessionTtlSeconds: 604800,
      oauthStateTtlSeconds: 600
    });

    const context =
      await service.resolveSessionContext(
        "A".repeat(43),
        new Date(
          "2026-09-02T00:00:00Z"
        )
      );

    expect(update).toHaveBeenCalledTimes(1);
    expect(touch).toHaveBeenCalledTimes(1);
    expect(
      decryptCredential(
        context!
          .githubAccessTokenCiphertext,
        key
      )
    ).toBe("ghu_new");
    expect(
      context?.githubAccessTokenExpiresAt
        ?.toISOString()
    ).toBe(
      "2026-09-02T01:00:00.000Z"
    );
  });

  it("fails closed to reauthentication material when refresh fails", async () => {
    const oldUser = userRow();

    const service = new AuthService({
      oauth: {
        refreshAccessToken:
          vi.fn(async () => {
            throw new Error("refresh failed");
          })
      } as never,
      users: {
        upsertGitHubUser:
          vi.fn() as never,
        updateGitHubCredentials:
          vi.fn() as never
      },
      sessions: {
        create: vi.fn() as never,
        findActiveByTokenHash:
          async () => ({
            session: sessionRow(),
            user: oldUser
          }),
        revokeByTokenHash:
          async () => true
      },
      oauthStates: {} as never,
      credentialEncryptionKey: key,
      secureCookies: false,
      sessionTtlSeconds: 604800,
      oauthStateTtlSeconds: 600
    });

    const context =
      await service.resolveSessionContext(
        "A".repeat(43),
        new Date(
          "2026-09-02T00:00:00Z"
        )
      );

    expect(
      context?.githubAccessTokenExpiresAt
        ?.toISOString()
    ).toBe(
      "2026-09-01T23:59:00.000Z"
    );
  });
});

import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  AuthSessionRow,
  AuthUserRow
} from "@contribos/db";

import {
  AuthService
} from "../src/security/auth-service.js";
import {
  decryptCredential
} from "../src/security/credential-cipher.js";
import {
  createOAuthState,
  hashOAuthState
} from "../src/security/oauth-state.js";

const key =
  Buffer.alloc(32, 19)
    .toString("base64");

function userRow():
  AuthUserRow {
  const now =
    new Date(
      "2026-08-27T00:00:00Z"
    );

  return {
    id:
      "00000000-0000-4000-8000-000000000001",
    provider: "GITHUB",
    providerUserId: "42",
    login: "octocat",
    avatarUrl: null,
    githubAccessTokenCiphertext:
      "ciphertext",
    githubAccessTokenExpiresAt:
      null,
    githubRefreshTokenCiphertext:
      null,
    githubRefreshTokenExpiresAt:
      null,
    createdAt: now,
    updatedAt: now
  };
}

function sessionRow():
  AuthSessionRow {
  const now =
    new Date(
      "2026-08-27T00:00:00Z"
    );

  return {
    id:
      "00000000-0000-4000-8000-000000000002",
    userId:
      "00000000-0000-4000-8000-000000000001",
    tokenHash:
      "a".repeat(64),
    expiresAt:
      new Date(
        "2026-09-03T00:00:00Z"
      ),
    revokedAt: null,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  };
}

describe(
  "AuthService",
  () => {
    it("creates durable OAuth state before redirect", async () => {
      const create = vi.fn(
        async () => ({})
      );

      const service =
        new AuthService({
          oauth: {
            authorizationUrl:
              (state: string) =>
                `https://github.com/login/oauth/authorize?state=${state}`
          } as never,
          users: {} as never,
          sessions: {} as never,
          oauthStates: {
            create,
            consume:
              async () => ({})
          },
          credentialEncryptionKey:
            key,
          secureCookies: false,
          sessionTtlSeconds:
            604800,
          oauthStateTtlSeconds:
            600
        });

      const result =
        await service.beginLogin(
          new Date(
            "2026-08-27T00:00:00Z"
          )
        );

      expect(create).toHaveBeenCalledTimes(
        1
      );
      expect(
        result.authorizationUrl
      ).toContain(
        "https://github.com/"
      );
      expect(
        result.stateCookie
      ).toContain("HttpOnly");
    });

    it("exchanges identity, encrypts GitHub tokens, and creates a server session", async () => {
      const state =
        createOAuthState();

      const upsertGitHubUser =
        vi.fn(
          async (input) => {
            expect(
              input.githubAccessTokenCiphertext
            ).not.toBe(
              "ghu_access"
            );
            expect(
              decryptCredential(
                input.githubAccessTokenCiphertext,
                key
              )
            ).toBe(
              "ghu_access"
            );

            return userRow();
          }
        );

      const createSession =
        vi.fn(
          async () =>
            sessionRow()
        );

      const service =
        new AuthService({
          oauth: {
            exchangeCode:
              async () => ({
                accessToken:
                  "ghu_access",
                accessTokenExpiresAt:
                  null,
                refreshToken:
                  "ghr_refresh",
                refreshTokenExpiresAt:
                  null
              }),
            fetchViewer:
              async () => ({
                id: 42,
                login: "octocat",
                avatarUrl: null
              })
          } as never,
          users: {
            upsertGitHubUser
          },
          sessions: {
            create: createSession,
            findActiveByTokenHash:
              async () => null,
            revokeByTokenHash:
              async () => true
          },
          oauthStates: {
            create:
              async () => ({}),
            consume:
              async (stateHash) =>
                stateHash ===
                hashOAuthState(state)
                  ? {}
                  : null
          },
          credentialEncryptionKey:
            key,
          secureCookies: true,
          sessionTtlSeconds:
            604800,
          oauthStateTtlSeconds:
            600
        });

      const result =
        await service.completeLogin(
          {
            code: "code",
            callbackState: state,
            cookieState: state
          },
          new Date(
            "2026-08-27T00:00:00Z"
          )
        );

      expect(
        upsertGitHubUser
      ).toHaveBeenCalledTimes(1);
      expect(
        createSession
      ).toHaveBeenCalledTimes(1);
      expect(result.principal).toEqual({
        provider: "GITHUB",
        providerUserId: "42",
        login: "octocat"
      });
      expect(
        result.sessionCookie
      ).toContain("HttpOnly");
      expect(
        result.sessionCookie
      ).toContain("Secure");
    });

    it("resolves the server-only authorization context for an active session", async () => {
      const activeUser =
        userRow();

      activeUser.githubAccessTokenCiphertext =
        "encrypted-user-token";

      const service =
        new AuthService({
          oauth: {} as never,
          users: {} as never,
          sessions: {
            create:
              async () =>
                sessionRow(),
            findActiveByTokenHash:
              async () => ({
                session:
                  sessionRow(),
                user:
                  activeUser
              }),
            revokeByTokenHash:
              async () => true
          },
          oauthStates: {} as never,
          credentialEncryptionKey:
            key,
          secureCookies: false,
          sessionTtlSeconds:
            604800,
          oauthStateTtlSeconds:
            600
        });

      const context =
        await service
          .resolveSessionContext(
            "A".repeat(43),
            new Date(
              "2026-08-27T00:00:00Z"
            )
          );

      expect(context).toEqual({
        sessionId:
          "00000000-0000-4000-8000-000000000002",
        userId:
          "00000000-0000-4000-8000-000000000001",
        principal: {
          provider: "GITHUB",
          providerUserId: "42",
          login: "octocat"
        },
        githubAccessTokenCiphertext:
          "encrypted-user-token",
        githubAccessTokenExpiresAt:
          null
      });
    });

    it("rejects a login callback with mismatched state", async () => {
      const service =
        new AuthService({
          oauth: {} as never,
          users: {} as never,
          sessions: {} as never,
          oauthStates: {} as never,
          credentialEncryptionKey:
            key,
          secureCookies: false,
          sessionTtlSeconds:
            604800,
          oauthStateTtlSeconds:
            600
        });

      await expect(
        service.completeLogin({
          code: "code",
          callbackState:
            createOAuthState(),
          cookieState:
            createOAuthState()
        })
      ).rejects.toThrow(
        "OAUTH_STATE_MISMATCH"
      );
    });
  }
);

import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  GitHubOAuthClient
} from "../src/security/github-oauth-client.js";

describe(
  "GitHub OAuth client",
  () => {
    it("builds the GitHub App user authorization URL", () => {
      const client =
        new GitHubOAuthClient({
          clientId: "client-123",
          clientSecret: "secret",
          callbackUrl:
            "http://localhost:3000/auth/github/callback"
        });

      const url = new URL(
        client.authorizationUrl(
          "state-123"
        )
      );

      expect(url.origin).toBe(
        "https://github.com"
      );
      expect(url.pathname).toBe(
        "/login/oauth/authorize"
      );
      expect(
        url.searchParams.get(
          "client_id"
        )
      ).toBe("client-123");
      expect(
        url.searchParams.get(
          "state"
        )
      ).toBe("state-123");
    });

    it("exchanges a code and resolves the GitHub viewer", async () => {
      const fetchFn = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token:
                "ghu_access",
              expires_in: 3600,
              refresh_token:
                "ghr_refresh",
              refresh_token_expires_in:
                7200
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json"
              }
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 42,
              login: "octocat",
              avatar_url:
                "https://example/avatar"
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json"
              }
            }
          )
        );

      const client =
        new GitHubOAuthClient({
          clientId: "client",
          clientSecret: "secret",
          callbackUrl:
            "http://localhost:3000/auth/github/callback",
          fetchFn
        });

      const now =
        new Date(
          "2026-08-27T00:00:00Z"
        );

      const token =
        await client.exchangeCode(
          "code",
          now
        );

      const viewer =
        await client.fetchViewer(
          token.accessToken
        );

      expect(token.accessToken).toBe(
        "ghu_access"
      );
      expect(
        token.accessTokenExpiresAt
          ?.toISOString()
      ).toBe(
        "2026-08-27T01:00:00.000Z"
      );
      expect(viewer).toEqual({
        id: 42,
        login: "octocat",
        avatarUrl:
          "https://example/avatar"
      });
    });
  it("refreshes an expiring GitHub App user access token", async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "ghu_new",
            expires_in: 3600,
            refresh_token: "ghr_new",
            refresh_token_expires_in: 7200
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const client = new GitHubOAuthClient({
      clientId: "client",
      clientSecret: "secret",
      callbackUrl: "http://localhost:3000/auth/github/callback",
      fetchFn
    });

    const token = await client.refreshAccessToken(
      "ghr_old",
      new Date("2026-09-02T00:00:00Z")
    );

    expect(token.accessToken).toBe("ghu_new");

    const request = fetchFn.mock.calls[0]?.[1];
    expect(String(request?.body)).toContain(
      "grant_type=refresh_token"
    );
    expect(String(request?.body)).toContain(
      "refresh_token=ghr_old"
    );
  });

  }
);

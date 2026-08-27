import {
  describe,
  expect,
  it
} from "vitest";

import {
  loadAuthConfig
} from "../src/security/auth-config.js";

const key =
  Buffer.alloc(32, 7)
    .toString("base64");

describe(
  "auth config",
  () => {
    it("loads local GitHub App user authorization configuration", () => {
      const config =
        loadAuthConfig({
          GITHUB_CLIENT_ID:
            "client-id",
          GITHUB_CLIENT_SECRET:
            "client-secret",
          CONTRIBOS_PUBLIC_BASE_URL:
            "http://localhost:5173",
          CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY:
            key
        });

      expect(
        config.callbackUrl
      ).toBe(
        "http://localhost:5173/auth/github/callback"
      );

      expect(
        config.secureCookies
      ).toBe(false);

      expect(
        config.sessionTtlSeconds
      ).toBe(604800);
    });

    it("accepts legacy OAuth variable names temporarily", () => {
      const config =
        loadAuthConfig({
          GITHUB_OAUTH_CLIENT_ID:
            "legacy-client",
          GITHUB_OAUTH_CLIENT_SECRET:
            "legacy-secret",
          CONTRIBOS_PUBLIC_BASE_URL:
            "http://localhost:5173",
          CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY:
            key
        });

      expect(
        config.githubOAuthClientId
      ).toBe("legacy-client");
    });

    it("rejects non-https public origins", () => {
      expect(() =>
        loadAuthConfig({
          GITHUB_CLIENT_ID:
            "client-id",
          GITHUB_CLIENT_SECRET:
            "client-secret",
          CONTRIBOS_PUBLIC_BASE_URL:
            "http://example.com",
          CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY:
            key
        })
      ).toThrow(/https/);
    });
  }
);

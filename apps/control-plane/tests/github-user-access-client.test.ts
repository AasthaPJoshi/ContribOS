import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  GitHubUserAccessClient
} from "../src/security/github-user-access-client.js";

describe(
  "GitHub user access client",
  () => {
    it("lists installations available to the GitHub App user token", async () => {
      const fetchFn =
        vi.fn<typeof fetch>()
          .mockResolvedValue(
            new Response(
              JSON.stringify({
                total_count: 1,
                installations: [
                  {
                    id: 99,
                    account: {
                      login:
                        "example-org"
                    }
                  }
                ]
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
        new GitHubUserAccessClient({
          fetchFn
        });

      await expect(
        client.listInstallations(
          "ghu_token"
        )
      ).resolves.toEqual([
        {
          id: 99,
          accountLogin:
            "example-org",
          accountType: null,
          repositorySelection: null,
          permissions: {}
        }
      ]);

      expect(
        fetchFn.mock.calls[0]?.[0]
      ).toContain(
        "/user/installations"
      );
    });

    it("lists repositories and preserves GitHub permission evidence", async () => {
      const fetchFn =
        vi.fn<typeof fetch>()
          .mockResolvedValue(
            new Response(
              JSON.stringify({
                total_count: 1,
                repositories: [
                  {
                    id: 123,
                    full_name:
                      "example-org/repo",
                    private: true,
                    permissions: {
                      admin: false,
                      maintain: true,
                      push: true,
                      pull: true
                    }
                  }
                ]
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
        new GitHubUserAccessClient({
          fetchFn
        });

      await expect(
        client.listRepositories(
          "ghu_token",
          99
        )
      ).resolves.toEqual([
        {
          id: 123,
          owner:
            "example-org",
          name: "repo",
          fullName:
            "example-org/repo",
          defaultBranch: null,
          isPrivate: true,
          permissions: {
            admin: false,
            maintain: true,
            push: true,
            pull: true
          }
        }
      ]);
    });

    it("treats a rejected user token as reauthentication material", async () => {
      const client =
        new GitHubUserAccessClient({
          fetchFn:
            vi.fn<typeof fetch>()
              .mockResolvedValue(
                new Response(
                  JSON.stringify({
                    message:
                      "Bad credentials"
                  }),
                  {
                    status: 401,
                    headers: {
                      "content-type":
                        "application/json"
                    }
                  }
                )
              )
        });

      await expect(
        client.listInstallations(
          "expired"
        )
      ).rejects.toThrow(
        "GITHUB_USER_TOKEN_INVALID"
      );
    });
  }
);

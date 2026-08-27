import {
  describe,
  expect,
  it
} from "vitest";

import {
  encryptCredential
} from "../src/security/credential-cipher.js";
import {
  RepositoryAuthorizationService
} from "../src/security/repository-authorization-service.js";

const key =
  Buffer.alloc(32, 23)
    .toString("base64");

const scope = {
  repositoryId:
    "00000000-0000-4000-8000-000000000101",
  githubRepositoryId: "123",
  repositoryFullName:
    "example-org/repo",
  isPrivate: true,
  installationId:
    "00000000-0000-4000-8000-000000000102",
  githubInstallationId: "99"
};

const subject = {
  principal: {
    provider: "GITHUB",
    providerUserId: "42",
    login: "octocat"
  } as const,
  githubAccessTokenCiphertext:
    encryptCredential(
      "ghu_user_token",
      key
    ),
  githubAccessTokenExpiresAt:
    null
};

describe(
  "repository authorization service",
  () => {
    it("authorizes only when installation and repository are available to the user", async () => {
      const service =
        new RepositoryAuthorizationService(
          {
            scopes: {
              findByGitHubRepositoryId:
                async () => scope
            },
            github: {
              listInstallations:
                async () => [
                  {
                    id: 99,
                    accountLogin:
                      "example-org"
                  }
                ],
              listRepositories:
                async () => [
                  {
                    id: 123,
                    fullName:
                      "example-org/repo",
                    isPrivate: true,
                    permissions: {
                      maintain: true,
                      pull: true
                    }
                  }
                ]
            } as never,
            credentialEncryptionKey:
              key
          }
        );

      await expect(
        service.authorize(
          subject,
          123,
          "MAINTAIN"
        )
      ).resolves.toEqual({
        allowed: true,
        accessLevel: "MAINTAIN",
        repository: scope
      });
    });

    it("denies when installation is outside user scope", async () => {
      const service =
        new RepositoryAuthorizationService(
          {
            scopes: {
              findByGitHubRepositoryId:
                async () => scope
            },
            github: {
              listInstallations:
                async () => [],
              listRepositories:
                async () => []
            } as never,
            credentialEncryptionKey:
              key
          }
        );

      await expect(
        service.authorize(
          subject,
          123
        )
      ).resolves.toEqual({
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      });
    });

    it("denies when repository is outside user scope", async () => {
      const service =
        new RepositoryAuthorizationService(
          {
            scopes: {
              findByGitHubRepositoryId:
                async () => scope
            },
            github: {
              listInstallations:
                async () => [
                  {
                    id: 99,
                    accountLogin:
                      "example-org"
                  }
                ],
              listRepositories:
                async () => []
            } as never,
            credentialEncryptionKey:
              key
          }
        );

      await expect(
        service.authorize(
          subject,
          123
        )
      ).resolves.toEqual({
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      });
    });

    it("enforces requested ContribOS access level", async () => {
      const service =
        new RepositoryAuthorizationService(
          {
            scopes: {
              findByGitHubRepositoryId:
                async () => scope
            },
            github: {
              listInstallations:
                async () => [
                  {
                    id: 99,
                    accountLogin:
                      "example-org"
                  }
                ],
              listRepositories:
                async () => [
                  {
                    id: 123,
                    fullName:
                      "example-org/repo",
                    isPrivate: true,
                    permissions: {
                      pull: true
                    }
                  }
                ]
            } as never,
            credentialEncryptionKey:
              key
          }
        );

      await expect(
        service.authorize(
          subject,
          123,
          "MAINTAIN"
        )
      ).resolves.toEqual({
        allowed: false,
        reason:
          "INSUFFICIENT_ACCESS"
      });
    });

    it("requires reauthentication for expired GitHub user token", async () => {
      const service =
        new RepositoryAuthorizationService(
          {
            scopes: {
              findByGitHubRepositoryId:
                async () => scope
            },
            github: {} as never,
            credentialEncryptionKey:
              key
          }
        );

      await expect(
        service.authorize(
          {
            ...subject,
            githubAccessTokenExpiresAt:
              new Date(
                "2026-08-26T00:00:00Z"
              )
          },
          123,
          "READ",
          new Date(
            "2026-08-27T00:00:00Z"
          )
        )
      ).resolves.toEqual({
        allowed: false,
        reason:
          "REAUTHENTICATION_REQUIRED"
      });
    });
  }
);

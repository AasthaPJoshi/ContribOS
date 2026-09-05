import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  encryptCredential
} from "../src/security/credential-cipher.js";

import {
  GitHubInstallationSyncService
} from "../src/security/github-installation-sync-service.js";

describe(
  "GitHubInstallationSyncService",
  () => {
    it(
      "upserts installations and repositories",
      async () => {
        const installations = {
          upsert: vi.fn(
            async () => ({
              id: "local-installation"
            })
          )
        };

        const repositories = {
          upsert: vi.fn(
            async () => ({
              id: "local-repository"
            })
          )
        };

        const github = {
          listInstallations:
            vi.fn(async () => [
              {
                id: 10,
                accountLogin: "example",
                accountType: "User",
                repositorySelection:
                  "selected",
                permissions: {
                  contents: "read"
                }
              }
            ]),
          listRepositories:
            vi.fn(async () => [
              {
                id: 20,
                owner: "example",
                name: "repo",
                fullName:
                  "example/repo",
                defaultBranch:
                  "main",
                isPrivate: true,
                permissions: {
                  admin: true
                }
              }
            ])
        };

        const key =
          Buffer.alloc(32, 23)
            .toString("base64");

        const service =
          new GitHubInstallationSyncService({
            installations:
              installations as never,
            repositories:
              repositories as never,
            github: github as never,
            credentialEncryptionKey: key
          });

        const result =
          await service.sync({
            githubAccessTokenCiphertext:
              encryptCredential(
                "token",
                key
              ),
            githubAccessTokenExpiresAt:
              null
          });

        expect(result).toEqual({
          installationsSynced: 1,
          repositoriesSynced: 1
        });

        expect(
          installations.upsert
        ).toHaveBeenCalledTimes(1);

        expect(
          repositories.upsert
        ).toHaveBeenCalledTimes(1);

      }
    );

    it(
      "does not deactivate repositories from user-scoped visibility",
      async () => {
        const installations = {
          upsert: vi.fn(
            async () => ({
              id: "local-installation"
            })
          )
        };

        const repositories = {
          upsert: vi.fn()
        };

        const github = {
          listInstallations:
            vi.fn(async () => [
              {
                id: 10,
                accountLogin: "example",
                accountType: "User",
                repositorySelection:
                  "selected",
                permissions: {}
              }
            ]),
          listRepositories:
            vi.fn(async () => [])
        };

        const key =
          Buffer.alloc(32, 23)
            .toString("base64");

        const service =
          new GitHubInstallationSyncService({
            installations:
              installations as never,
            repositories:
              repositories as never,
            github: github as never,
            credentialEncryptionKey: key
          });

        const result =
          await service.sync({
            githubAccessTokenCiphertext:
              encryptCredential(
                "token",
                key
              ),
            githubAccessTokenExpiresAt:
              null
          });

        expect(result).toEqual({
          installationsSynced: 1,
          repositoriesSynced: 0
        });

        expect(
          repositories.upsert
        ).not.toHaveBeenCalled();
      }
    );
  }
);

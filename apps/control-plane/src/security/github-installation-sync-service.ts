import type {
  InstallationRow,
  RepositoryRow,
  UpsertInstallationInput,
  UpsertRepositoryInput
} from "@contribos/db";

import {
  decryptCredential
} from "./credential-cipher.js";

import type {
  GitHubUserAccessClient
} from "./github-user-access-client.js";

export interface InstallationSyncStore {
  upsert(
    input: UpsertInstallationInput
  ): Promise<InstallationRow>;
}

export interface RepositorySyncStore {
  upsert(
    input: UpsertRepositoryInput
  ): Promise<RepositoryRow>;
}

export interface GitHubInstallationSyncSubject {
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt: Date | null;
}

export interface GitHubInstallationSyncServiceOptions {
  installations: InstallationSyncStore;
  repositories: RepositorySyncStore;
  github: GitHubUserAccessClient;
  credentialEncryptionKey: string;
}

export interface InstallationSyncResult {
  installationsSynced: number;
  repositoriesSynced: number;
}

export class GitHubInstallationSyncService {
  constructor(
    private readonly options:
      GitHubInstallationSyncServiceOptions
  ) {}

  async sync(
    subject: GitHubInstallationSyncSubject,
    now = new Date()
  ): Promise<InstallationSyncResult> {
    if (
      subject.githubAccessTokenExpiresAt &&
      subject.githubAccessTokenExpiresAt.getTime() <=
        now.getTime()
    ) {
      throw new Error(
        "REAUTHENTICATION_REQUIRED"
      );
    }

    const accessToken =
      decryptCredential(
        subject.githubAccessTokenCiphertext,
        this.options.credentialEncryptionKey
      );

    const githubInstallations =
      await this.options.github
        .listInstallations(accessToken);

    let repositoriesSynced = 0;

    for (
      const githubInstallation of
      githubInstallations
    ) {
      const installation =
        await this.options.installations
          .upsert({
            githubInstallationId:
              String(
                githubInstallation.id
              ),
            accountLogin:
              githubInstallation.accountLogin,
            accountType:
              githubInstallation.accountType,
            permissions:
              githubInstallation.permissions,
            repositorySelection:
              githubInstallation.repositorySelection
          });

      const githubRepositories =
        await this.options.github
          .listRepositories(
            accessToken,
            githubInstallation.id
          );

      for (
        const githubRepository of
        githubRepositories
      ) {
        const githubRepositoryId =
          String(githubRepository.id);

        await this.options.repositories
          .upsert({
            installationId:
              installation.id,
            githubRepositoryId,
            owner:
              githubRepository.owner,
            name:
              githubRepository.name,
            fullName:
              githubRepository.fullName,
            defaultBranch:
              githubRepository.defaultBranch,
            isPrivate:
              githubRepository.isPrivate
          });

        repositoriesSynced += 1;
      }

    }

    return {
      installationsSynced:
        githubInstallations.length,
      repositoriesSynced
    };
  }
}

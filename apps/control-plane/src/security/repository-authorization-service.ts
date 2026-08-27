import type {
  RepositoryAccessScopeRow
} from "@contribos/db";

import type {
  AuthenticatedPrincipal,
  RepositoryAccessLevel
} from "./auth-types.js";
import {
  authorizeRepositoryAccess
} from "./repository-access-policy.js";
import {
  decryptCredential
} from "./credential-cipher.js";
import {
  mapGitHubRepositoryPermission
} from "./github-repository-permission.js";
import type {
  GitHubUserAccessClient,
  UserAccessibleInstallation,
  UserAccessibleRepository
} from "./github-user-access-client.js";

export interface RepositoryAccessScopeStore {
  findByGitHubRepositoryId(
    githubRepositoryId: string
  ): Promise<
    RepositoryAccessScopeRow | null
  >;
}

export interface RepositoryAuthorizationSubject {
  principal: AuthenticatedPrincipal;
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt:
    Date | null;
}

export type RepositoryAuthorizationResult =
  | {
      allowed: true;
      accessLevel:
        RepositoryAccessLevel;
      repository:
        RepositoryAccessScopeRow;
    }
  | {
      allowed: false;
      reason:
        | "REPOSITORY_NOT_AUTHORIZED"
        | "INSUFFICIENT_ACCESS"
        | "REAUTHENTICATION_REQUIRED";
    };

export interface RepositoryAuthorizationServiceOptions {
  scopes:
    RepositoryAccessScopeStore;
  github:
    GitHubUserAccessClient;
  credentialEncryptionKey: string;
}

function positiveSafeInteger(
  value: number
): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export class RepositoryAuthorizationService {
  constructor(
    private readonly options:
      RepositoryAuthorizationServiceOptions
  ) {}

  async authorize(
    subject:
      RepositoryAuthorizationSubject,
    githubRepositoryId: number,
    requiredLevel:
      RepositoryAccessLevel = "READ",
    now = new Date()
  ): Promise<
    RepositoryAuthorizationResult
  > {
    if (
      !positiveSafeInteger(
        githubRepositoryId
      )
    ) {
      return {
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      };
    }

    if (
      subject
        .githubAccessTokenExpiresAt &&
      subject
        .githubAccessTokenExpiresAt
        .getTime() <= now.getTime()
    ) {
      return {
        allowed: false,
        reason:
          "REAUTHENTICATION_REQUIRED"
      };
    }

    const scope =
      await this.options.scopes
        .findByGitHubRepositoryId(
          String(
            githubRepositoryId
          )
        );

    if (!scope) {
      return {
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      };
    }

    const accessToken =
      decryptCredential(
        subject
          .githubAccessTokenCiphertext,
        this.options
          .credentialEncryptionKey
      );

    let installations:
      UserAccessibleInstallation[];

    try {
      installations =
        await this.options.github
          .listInstallations(
            accessToken
          );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "GITHUB_USER_TOKEN_INVALID"
      ) {
        return {
          allowed: false,
          reason:
            "REAUTHENTICATION_REQUIRED"
        };
      }

      throw error;
    }

    const installation =
      installations.find(
        (candidate) =>
          String(candidate.id) ===
          scope.githubInstallationId
      );

    if (!installation) {
      return {
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      };
    }

    let repositories:
      UserAccessibleRepository[];

    try {
      repositories =
        await this.options.github
          .listRepositories(
            accessToken,
            installation.id
          );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "GITHUB_USER_TOKEN_INVALID"
      ) {
        return {
          allowed: false,
          reason:
            "REAUTHENTICATION_REQUIRED"
        };
      }

      throw error;
    }

    const repository =
      repositories.find(
        (candidate) =>
          candidate.id ===
          githubRepositoryId
      );

    if (!repository) {
      return {
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      };
    }

    const grantedLevel =
      mapGitHubRepositoryPermission(
        repository.permissions
      );

    const policy =
      authorizeRepositoryAccess({
        principal:
          subject.principal,
        grantedLevel,
        requiredLevel
      });

    if (!policy.allowed) {
      return {
        allowed: false,
        reason:
          policy.reason ===
          "INSUFFICIENT_ACCESS"
            ? "INSUFFICIENT_ACCESS"
            : "REPOSITORY_NOT_AUTHORIZED"
      };
    }

    return {
      allowed: true,
      accessLevel:
        policy.level,
      repository: scope
    };
  }
}

import type {
  GitHubRepositoryPermissions
} from "./github-repository-permission.js";

const API_BASE =
  "https://api.github.com";
const API_VERSION =
  "2026-03-10";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface UserAccessibleInstallation {
  id: number;
  accountLogin: string | null;
}

export interface UserAccessibleRepository {
  id: number;
  fullName: string;
  isPrivate: boolean;
  permissions:
    GitHubRepositoryPermissions;
}

export interface GitHubUserAccessClientOptions {
  fetchFn?: typeof fetch;
}

interface InstallationResponse {
  total_count?: number;
  installations?: Array<{
    id?: number;
    account?: {
      login?: string;
    } | null;
  }>;
}

interface RepositoryResponse {
  total_count?: number;
  repositories?: Array<{
    id?: number;
    full_name?: string;
    private?: boolean;
    permissions?:
      GitHubRepositoryPermissions;
  }>;
}

function headers(
  accessToken: string
): Record<string, string> {
  return {
    accept:
      "application/vnd.github+json",
    authorization:
      `Bearer ${accessToken}`,
    "x-github-api-version":
      API_VERSION,
    "user-agent": "ContribOS"
  };
}

function pagedUrl(
  pathname: string,
  page: number
): string {
  const url = new URL(
    pathname,
    API_BASE
  );

  url.searchParams.set(
    "per_page",
    String(PAGE_SIZE)
  );
  url.searchParams.set(
    "page",
    String(page)
  );

  return url.toString();
}

export class GitHubUserAccessClient {
  private readonly fetchFn:
    typeof fetch;

  constructor(
    options:
      GitHubUserAccessClientOptions = {}
  ) {
    this.fetchFn =
      options.fetchFn ?? fetch;
  }

  async listInstallations(
    accessToken: string
  ): Promise<
    UserAccessibleInstallation[]
  > {
    const result:
      UserAccessibleInstallation[] = [];

    for (
      let page = 1;
      page <= MAX_PAGES;
      page += 1
    ) {
      const response =
        await this.fetchFn(
          pagedUrl(
            "/user/installations",
            page
          ),
          {
            method: "GET",
            headers:
              headers(accessToken)
          }
        );

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "GITHUB_USER_TOKEN_INVALID"
            : "GITHUB_INSTALLATION_LIST_FAILED"
        );
      }

      const payload =
        (await response.json()) as
          InstallationResponse;

      const installations =
        payload.installations ?? [];

      for (
        const installation of
        installations
      ) {
        if (
          typeof installation.id !==
          "number"
        ) {
          continue;
        }

        result.push({
          id: installation.id,
          accountLogin:
            installation.account
              ?.login ?? null
        });
      }

      const total =
        payload.total_count ??
        result.length;

      if (
        installations.length <
          PAGE_SIZE ||
        result.length >= total
      ) {
        return result;
      }
    }

    throw new Error(
      "GITHUB_INSTALLATION_PAGINATION_LIMIT"
    );
  }

  async listRepositories(
    accessToken: string,
    installationId: number
  ): Promise<
    UserAccessibleRepository[]
  > {
    const result:
      UserAccessibleRepository[] = [];

    for (
      let page = 1;
      page <= MAX_PAGES;
      page += 1
    ) {
      const response =
        await this.fetchFn(
          pagedUrl(
            `/user/installations/${installationId}/repositories`,
            page
          ),
          {
            method: "GET",
            headers:
              headers(accessToken)
          }
        );

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "GITHUB_USER_TOKEN_INVALID"
            : "GITHUB_REPOSITORY_LIST_FAILED"
        );
      }

      const payload =
        (await response.json()) as
          RepositoryResponse;

      const repositories =
        payload.repositories ?? [];

      for (
        const repository of
        repositories
      ) {
        if (
          typeof repository.id !==
            "number" ||
          !repository.full_name
        ) {
          continue;
        }

        result.push({
          id: repository.id,
          fullName:
            repository.full_name,
          isPrivate:
            repository.private ===
            true,
          permissions:
            repository.permissions ??
            {}
        });
      }

      const total =
        payload.total_count ??
        result.length;

      if (
        repositories.length <
          PAGE_SIZE ||
        result.length >= total
      ) {
        return result;
      }
    }

    throw new Error(
      "GITHUB_REPOSITORY_PAGINATION_LIMIT"
    );
  }
}

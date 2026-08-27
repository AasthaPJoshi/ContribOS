import {
  defaultGitHubFetch,
  type GitHubFetch,
  type GitHubHttpResponse
} from "./github-http.js";
import type {
  GitHubInstallationToken,
  GitHubInstallationTokenProvider
} from "./github-app-auth.js";
import {
  getMissingGitHubPermissions,
  type GitHubPermissionRequirement
} from "./github-permissions.js";
import { isRepositoryAuthorizedByToken } from "./github-repository-scope.js";

export interface GitHubApiClientConfig {
  tokenProvider: GitHubInstallationTokenProvider;
  apiBaseUrl?: string;
  apiVersion?: string;
  userAgent?: string;
  fetchImpl?: GitHubFetch;
}

export interface GitHubApiRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  requiredPermissions?: readonly GitHubPermissionRequirement[];
  repositoryId?: number;
}

export class GitHubApiError extends Error {
  readonly status: number;
  readonly reasonCode: string;

  constructor(message: string, status: number, reasonCode = "GITHUB_API_ERROR") {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.reasonCode = reasonCode;
  }
}

async function readResponseBody(response: GitHubHttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
}

export class GitHubApiClient {
  private readonly tokenProvider: GitHubInstallationTokenProvider;
  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;
  private readonly userAgent: string;
  private readonly fetchImpl: GitHubFetch;

  constructor(config: GitHubApiClientConfig) {
    this.tokenProvider = config.tokenProvider;
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api.github.com").replace(
      /\/+$/,
      ""
    );
    this.apiVersion = config.apiVersion ?? "2022-11-28";
    this.userAgent = config.userAgent ?? "ContribOS";
    this.fetchImpl = config.fetchImpl ?? defaultGitHubFetch;
  }

  private validateScope(
    token: GitHubInstallationToken,
    options: GitHubApiRequestOptions
  ): void {
    if (options.requiredPermissions) {
      const missing = getMissingGitHubPermissions(
        token,
        options.requiredPermissions
      );

      if (missing.length > 0) {
        throw new GitHubApiError(
          "GitHub installation token does not satisfy the required permissions.",
          403,
          "INSUFFICIENT_INSTALLATION_PERMISSIONS"
        );
      }
    }

    if (
      options.repositoryId !== undefined &&
      !isRepositoryAuthorizedByToken(token, options.repositoryId)
    ) {
      throw new GitHubApiError(
        "GitHub installation token is not authorized for the requested repository.",
        403,
        "REPOSITORY_OUT_OF_SCOPE"
      );
    }
  }

  private async executeRequest(
    installationId: number,
    path: string,
    options: GitHubApiRequestOptions,
    forceRefresh: boolean
  ): Promise<GitHubHttpResponse> {
    const installationToken = await this.tokenProvider.getToken(
      installationId,
      { forceRefresh }
    );

    this.validateScope(installationToken, options);

    const callerHeaders: Record<string, string> = {};

    for (const [key, value] of Object.entries(options.headers ?? {})) {
      if (key.toLowerCase() === "authorization") {
        throw new GitHubApiError(
          "Caller-provided Authorization headers are not allowed.",
          0,
          "AUTHORIZATION_HEADER_OVERRIDE"
        );
      }

      callerHeaders[key] = value;
    }

    const headers: Record<string, string> = {
      ...callerHeaders,
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${installationToken.token}`,
      "X-GitHub-Api-Version": this.apiVersion,
      "User-Agent": this.userAgent
    };

    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body);

    if (body !== undefined && headers["Content-Type"] === undefined) {
      headers["Content-Type"] = "application/json";
    }

    return this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(body === undefined ? {} : { body })
    });
  }

  async request<T>(
    installationId: number,
    path: string,
    options: GitHubApiRequestOptions = {}
  ): Promise<T> {
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      throw new GitHubApiError(
        "GitHub installation ID must be a positive integer.",
        0,
        "INVALID_INSTALLATION_ID"
      );
    }

    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new GitHubApiError(
        "GitHub API path must start with exactly one '/'.",
        0,
        "INVALID_API_PATH"
      );
    }

    let response = await this.executeRequest(
      installationId,
      path,
      options,
      false
    );

    if (response.status === 401) {
      this.tokenProvider.invalidate(installationId);

      response = await this.executeRequest(
        installationId,
        path,
        options,
        true
      );
    }

    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      throw new GitHubApiError(
        `GitHub API request failed with HTTP ${response.status}.`,
        response.status
      );
    }

    return responseBody as T;
  }
}

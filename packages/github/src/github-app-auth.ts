import { createSign } from "node:crypto";

import {
  defaultGitHubFetch,
  type GitHubFetch,
  type GitHubHttpResponse
} from "./github-http.js";

export type GitHubRepositorySelection = "all" | "selected";

export interface GitHubInstallationToken {
  token: string;
  expiresAt: Date;
  permissions: Record<string, string>;
  repositorySelection: GitHubRepositorySelection;
  repositoryIds: number[] | null;
}

export interface GitHubAppAuthConfig {
  appId: string | number;
  privateKey: string;
  apiBaseUrl?: string;
  apiVersion?: string;
  userAgent?: string;
  clock?: () => Date;
  fetchImpl?: GitHubFetch;
}

export class GitHubAuthError extends Error {
  readonly status: number | null;
  readonly reasonCode: string;

  constructor(
    message: string,
    reasonCode: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "GitHubAuthError";
    this.status = status;
    this.reasonCode = reasonCode;
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function parsePermissions(value: unknown): Record<string, string> {
  const record = asRecord(value);

  if (!record) {
    throw new GitHubAuthError(
      "GitHub returned an invalid installation token permissions object.",
      "INVALID_INSTALLATION_TOKEN_RESPONSE"
    );
  }

  const permissions: Record<string, string> = {};

  for (const [key, level] of Object.entries(record)) {
    if (typeof level !== "string" || !level.trim()) {
      throw new GitHubAuthError(
        "GitHub returned an invalid installation token permission value.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE"
      );
    }

    permissions[key] = level;
  }

  return permissions;
}

function parseRepositoryIds(value: unknown): number[] | null {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new GitHubAuthError(
      "GitHub returned an invalid repositories collection.",
      "INVALID_INSTALLATION_TOKEN_RESPONSE"
    );
  }

  const repositoryIds: number[] = [];

  for (const repository of value) {
    const record = asRecord(repository);
    const id = record?.["id"];

    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
      throw new GitHubAuthError(
        "GitHub returned an invalid repository in the installation token response.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE"
      );
    }

    repositoryIds.push(id);
  }

  return repositoryIds;
}

export class GitHubAppAuth {
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;
  private readonly userAgent: string;
  private readonly clock: () => Date;
  private readonly fetchImpl: GitHubFetch;

  constructor(config: GitHubAppAuthConfig) {
    const appId = String(config.appId).trim();

    if (!appId) {
      throw new GitHubAuthError(
        "GitHub App ID is required.",
        "MISSING_APP_ID"
      );
    }

    if (!config.privateKey.trim()) {
      throw new GitHubAuthError(
        "GitHub App private key is required.",
        "MISSING_PRIVATE_KEY"
      );
    }

    this.appId = appId;
    this.privateKey = config.privateKey;
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api.github.com").replace(
      /\/+$/,
      ""
    );
    this.apiVersion = config.apiVersion ?? "2022-11-28";
    this.userAgent = config.userAgent ?? "ContribOS";
    this.clock = config.clock ?? (() => new Date());
    this.fetchImpl = config.fetchImpl ?? defaultGitHubFetch;
  }

  createAppJwt(): string {
    const now = Math.floor(this.clock().getTime() / 1000);

    const header = encodeJson({
      alg: "RS256",
      typ: "JWT"
    });

    const payload = encodeJson({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: this.appId
    });

    const unsignedToken = `${header}.${payload}`;

    const signer = createSign("RSA-SHA256");
    signer.update(unsignedToken);
    signer.end();

    let signature: Buffer;

    try {
      signature = signer.sign(this.privateKey);
    } catch {
      throw new GitHubAuthError(
        "Unable to sign the GitHub App JWT with the configured private key.",
        "JWT_SIGNING_FAILED"
      );
    }

    return `${unsignedToken}.${signature.toString("base64url")}`;
  }

  async createInstallationToken(
    installationId: number
  ): Promise<GitHubInstallationToken> {
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      throw new GitHubAuthError(
        "GitHub installation ID must be a positive integer.",
        "INVALID_INSTALLATION_ID"
      );
    }

    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.createAppJwt()}`,
          "X-GitHub-Api-Version": this.apiVersion,
          "User-Agent": this.userAgent
        }
      }
    );

    const body = await readResponseBody(response);

    if (!response.ok) {
      throw new GitHubAuthError(
        `GitHub installation token request failed with HTTP ${response.status}.`,
        "INSTALLATION_TOKEN_REQUEST_FAILED",
        response.status
      );
    }

    const record = asRecord(body);

    if (!record) {
      throw new GitHubAuthError(
        "GitHub returned a non-object installation token response.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE",
        response.status
      );
    }

    const token = record["token"];
    const expiresAtRaw = record["expires_at"];
    const repositorySelectionRaw = record["repository_selection"];

    if (typeof token !== "string" || !token.trim()) {
      throw new GitHubAuthError(
        "GitHub returned an installation token response without a token.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE",
        response.status
      );
    }

    if (typeof expiresAtRaw !== "string") {
      throw new GitHubAuthError(
        "GitHub returned an installation token response without expires_at.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE",
        response.status
      );
    }

    const expiresAt = new Date(expiresAtRaw);

    if (Number.isNaN(expiresAt.getTime())) {
      throw new GitHubAuthError(
        "GitHub returned an invalid installation token expiry.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE",
        response.status
      );
    }

    if (
      repositorySelectionRaw !== "all" &&
      repositorySelectionRaw !== "selected"
    ) {
      throw new GitHubAuthError(
        "GitHub returned an invalid repository_selection value.",
        "INVALID_INSTALLATION_TOKEN_RESPONSE",
        response.status
      );
    }

    return {
      token,
      expiresAt,
      permissions: parsePermissions(record["permissions"]),
      repositorySelection: repositorySelectionRaw,
      repositoryIds: parseRepositoryIds(record["repositories"])
    };
  }
}

export interface GitHubInstallationTokenProviderConfig {
  auth: GitHubAppAuth;
  refreshSkewMs?: number;
  clock?: () => Date;
}

export class GitHubInstallationTokenProvider {
  private readonly auth: GitHubAppAuth;
  private readonly refreshSkewMs: number;
  private readonly clock: () => Date;
  private readonly cache = new Map<number, GitHubInstallationToken>();
  private readonly refreshes = new Map<
    number,
    Promise<GitHubInstallationToken>
  >();

  constructor(config: GitHubInstallationTokenProviderConfig) {
    this.auth = config.auth;
    this.refreshSkewMs = config.refreshSkewMs ?? 60_000;
    this.clock = config.clock ?? (() => new Date());

    if (this.refreshSkewMs < 0) {
      throw new GitHubAuthError(
        "Token refresh skew cannot be negative.",
        "INVALID_REFRESH_SKEW"
      );
    }
  }

  async getToken(
    installationId: number,
    options: { forceRefresh?: boolean } = {}
  ): Promise<GitHubInstallationToken> {
    const cached = this.cache.get(installationId);

    if (
      !options.forceRefresh &&
      cached &&
      cached.expiresAt.getTime() >
        this.clock().getTime() + this.refreshSkewMs
    ) {
      return cached;
    }

    const existingRefresh = this.refreshes.get(installationId);

    if (existingRefresh) {
      return existingRefresh;
    }

    const refresh = this.auth
      .createInstallationToken(installationId)
      .then((token) => {
        this.cache.set(installationId, token);
        return token;
      })
      .finally(() => {
        this.refreshes.delete(installationId);
      });

    this.refreshes.set(installationId, refresh);

    return refresh;
  }

  invalidate(installationId: number): void {
    this.cache.delete(installationId);
  }

  clear(): void {
    this.cache.clear();
  }
}

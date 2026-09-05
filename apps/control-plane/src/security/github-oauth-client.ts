const GITHUB_AUTHORIZE_URL =
  "https://github.com/login/oauth/authorize";

const GITHUB_TOKEN_URL =
  "https://github.com/login/oauth/access_token";

const GITHUB_USER_URL =
  "https://api.github.com/user";

const GITHUB_API_VERSION =
  "2026-03-10";

export interface GitHubOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  fetchFn?: typeof fetch;
}

export interface GitHubOAuthToken {
  accessToken: string;
  accessTokenExpiresAt: Date | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

export interface GitHubOAuthViewer {
  id: number;
  login: string;
  avatarUrl: string | null;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

interface UserResponse {
  id?: number;
  login?: string;
  avatar_url?: string | null;
}

function expiresAt(
  seconds: number | undefined,
  now: Date
): Date | null {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  return new Date(
    now.getTime() +
      seconds * 1000
  );
}

export class GitHubOAuthClient {
  private readonly fetchFn:
    typeof fetch;

  constructor(
    private readonly options:
      GitHubOAuthClientOptions
  ) {
    this.fetchFn =
      options.fetchFn ?? fetch;
  }

  authorizationUrl(
    state: string
  ): string {
    const url = new URL(
      GITHUB_AUTHORIZE_URL
    );

    url.searchParams.set(
      "client_id",
      this.options.clientId
    );
    url.searchParams.set(
      "redirect_uri",
      this.options.callbackUrl
    );
    url.searchParams.set(
      "state",
      state
    );

    return url.toString();
  }

  private async requestToken(
    body: URLSearchParams,
    now: Date
  ): Promise<GitHubOAuthToken> {
    const response = await this.fetchFn(
      GITHUB_TOKEN_URL,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type":
            "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const payload =
      await response.json() as
        TokenResponse;

    if (
      !response.ok ||
      !payload.access_token
    ) {
      throw new Error(
        payload.error ??
          "GITHUB_OAUTH_TOKEN_EXCHANGE_FAILED"
      );
    }

    return {
      accessToken:
        payload.access_token,
      accessTokenExpiresAt:
        expiresAt(
          payload.expires_in,
          now
        ),
      refreshToken:
        payload.refresh_token ??
        null,
      refreshTokenExpiresAt:
        expiresAt(
          payload.refresh_token_expires_in,
          now
        )
    };
  }

  async exchangeCode(
    code: string,
    now = new Date()
  ): Promise<GitHubOAuthToken> {
    return this.requestToken(
      new URLSearchParams({
        client_id:
          this.options.clientId,
        client_secret:
          this.options.clientSecret,
        code,
        redirect_uri:
          this.options.callbackUrl
      }),
      now
    );
  }

  async refreshAccessToken(
    refreshToken: string,
    now = new Date()
  ): Promise<GitHubOAuthToken> {
    if (!refreshToken.trim()) {
      throw new Error(
        "GITHUB_OAUTH_REFRESH_TOKEN_REQUIRED"
      );
    }

    return this.requestToken(
      new URLSearchParams({
        client_id:
          this.options.clientId,
        client_secret:
          this.options.clientSecret,
        grant_type:
          "refresh_token",
        refresh_token:
          refreshToken
      }),
      now
    );
  }

  async fetchViewer(
    accessToken: string
  ): Promise<GitHubOAuthViewer> {
    const response =
      await this.fetchFn(
        GITHUB_USER_URL,
        {
          method: "GET",
          headers: {
            accept:
              "application/vnd.github+json",
            authorization:
              `Bearer ${accessToken}`,
            "x-github-api-version":
              GITHUB_API_VERSION,
            "user-agent":
              "ContribOS"
          }
        }
      );

    const payload =
      await response.json() as
        UserResponse;

    if (
      !response.ok ||
      typeof payload.id !==
        "number" ||
      !payload.login
    ) {
      throw new Error(
        "GITHUB_OAUTH_USER_LOOKUP_FAILED"
      );
    }

    return {
      id: payload.id,
      login: payload.login,
      avatarUrl:
        payload.avatar_url ?? null
    };
  }
}

import type {
  AuthSessionRow,
  AuthUserRow,
  CreateAuthSessionInput,
  CreateOAuthStateInput,
  UpdateGitHubUserCredentialsInput,
  UpsertGitHubUserInput
} from "@contribos/db";

import type {
  AuthenticatedPrincipal,
  ResolvedAuthContext
} from "./auth-types.js";
import {
  decryptCredential,
  encryptCredential
} from "./credential-cipher.js";
import type {
  GitHubOAuthClient,
  GitHubOAuthToken,
  GitHubOAuthViewer
} from "./github-oauth-client.js";
import {
  buildOAuthStateCookie,
  buildOAuthStateDeletionCookie
} from "./oauth-state-cookie.js";
import {
  createOAuthState,
  hashOAuthState,
  oauthStatesMatch
} from "./oauth-state.js";
import {
  buildSessionCookie,
  buildSessionDeletionCookie
} from "./session-cookie.js";
import {
  createSessionToken,
  hashSessionToken
} from "./session-token.js";

const SESSION_TOUCH_INTERVAL_MS =
  5 * 60 * 1000;

export interface AuthUserStore {
  upsertGitHubUser(
    input: UpsertGitHubUserInput
  ): Promise<AuthUserRow>;

  updateGitHubCredentials?(
    id: string,
    input:
      UpdateGitHubUserCredentialsInput
  ): Promise<AuthUserRow>;
}

export interface AuthSessionStore {
  create(
    input: CreateAuthSessionInput
  ): Promise<AuthSessionRow>;

  findActiveByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<{
    session: AuthSessionRow;
    user: AuthUserRow;
  } | null>;

  revokeByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<boolean>;

  touch?(
    id: string,
    now?: Date
  ): Promise<void>;
}

export interface OAuthStateStore {
  create(
    input: CreateOAuthStateInput
  ): Promise<unknown>;

  consume(
    stateHash: string,
    now?: Date
  ): Promise<unknown | null>;
}

export interface AuthServiceOptions {
  oauth: GitHubOAuthClient;
  users: AuthUserStore;
  sessions: AuthSessionStore;
  oauthStates: OAuthStateStore;
  installationSync?: {
    sync(
      subject: {
        githubAccessTokenCiphertext: string;
        githubAccessTokenExpiresAt: Date | null;
      },
      now?: Date
    ): Promise<unknown>;
  };
  credentialEncryptionKey: string;
  secureCookies: boolean;
  sessionTtlSeconds: number;
  oauthStateTtlSeconds: number;
}

export interface BeginLoginResult {
  authorizationUrl: string;
  stateCookie: string;
}

export interface CompleteLoginInput {
  code: string;
  callbackState: string;
  cookieState: string;
}

export interface CompleteLoginResult {
  principal: AuthenticatedPrincipal;
  sessionCookie: string;
  clearStateCookie: string;
}

function encryptedUserInput(
  token: GitHubOAuthToken,
  viewer: GitHubOAuthViewer,
  key: string
): UpsertGitHubUserInput {
  return {
    providerUserId:
      String(viewer.id),
    login: viewer.login,
    avatarUrl: viewer.avatarUrl,
    githubAccessTokenCiphertext:
      encryptCredential(
        token.accessToken,
        key
      ),
    githubAccessTokenExpiresAt:
      token.accessTokenExpiresAt,
    githubRefreshTokenCiphertext:
      token.refreshToken
        ? encryptCredential(
            token.refreshToken,
            key
          )
        : null,
    githubRefreshTokenExpiresAt:
      token.refreshTokenExpiresAt
  };
}

function refreshTokenUsable(
  user: AuthUserRow,
  now: Date
): boolean {
  if (!user.githubRefreshTokenCiphertext) {
    return false;
  }

  return (
    !user.githubRefreshTokenExpiresAt ||
    user.githubRefreshTokenExpiresAt
      .getTime() > now.getTime()
  );
}

export class AuthService {
  constructor(
    private readonly options:
      AuthServiceOptions
  ) {}

  async beginLogin(
    now = new Date()
  ): Promise<BeginLoginResult> {
    const state = createOAuthState();

    await this.options.oauthStates.create({
      stateHash:
        hashOAuthState(state),
      expiresAt: new Date(
        now.getTime() +
          this.options
            .oauthStateTtlSeconds *
            1000
      )
    });

    return {
      authorizationUrl:
        this.options.oauth
          .authorizationUrl(state),
      stateCookie:
        buildOAuthStateCookie(
          state,
          {
            secure:
              this.options
                .secureCookies,
            maxAgeSeconds:
              this.options
                .oauthStateTtlSeconds
          }
        )
    };
  }

  async completeLogin(
    input: CompleteLoginInput,
    now = new Date()
  ): Promise<CompleteLoginResult> {
    if (
      !oauthStatesMatch(
        input.callbackState,
        input.cookieState
      )
    ) {
      throw new Error(
        "OAUTH_STATE_MISMATCH"
      );
    }

    const consumed =
      await this.options
        .oauthStates
        .consume(
          hashOAuthState(
            input.callbackState
          ),
          now
        );

    if (!consumed) {
      throw new Error(
        "OAUTH_STATE_INVALID_OR_EXPIRED"
      );
    }

    const token =
      await this.options.oauth
        .exchangeCode(
          input.code,
          now
        );

    const viewer =
      await this.options.oauth
        .fetchViewer(
          token.accessToken
        );

    const user =
      await this.options.users
        .upsertGitHubUser(
          encryptedUserInput(
            token,
            viewer,
            this.options
              .credentialEncryptionKey
          )
        );

    if (this.options.installationSync) {
      try {
        await this.options.installationSync.sync(
          {
            githubAccessTokenCiphertext:
              user.githubAccessTokenCiphertext,
            githubAccessTokenExpiresAt:
              user.githubAccessTokenExpiresAt
          },
          now
        );
      } catch {
        // Best-effort repository sync.
        // Login should still succeed if GitHub inventory sync fails.
      }
    }

    const sessionToken =
      createSessionToken();

    await this.options.sessions.create({
      userId: user.id,
      tokenHash:
        sessionToken.tokenHash,
      expiresAt: new Date(
        now.getTime() +
          this.options
            .sessionTtlSeconds *
            1000
      )
    });

    return {
      principal: {
        provider: "GITHUB",
        providerUserId:
          user.providerUserId,
        login: user.login
      },
      sessionCookie:
        buildSessionCookie(
          sessionToken.token,
          {
            secure:
              this.options
                .secureCookies,
            maxAgeSeconds:
              this.options
                .sessionTtlSeconds
          }
        ),
      clearStateCookie:
        buildOAuthStateDeletionCookie(
          this.options
            .secureCookies
        )
    };
  }

  private async refreshUserCredential(
    user: AuthUserRow,
    now: Date
  ): Promise<AuthUserRow> {
    const expiresAt =
      user.githubAccessTokenExpiresAt;

    if (
      !expiresAt ||
      expiresAt.getTime() >
        now.getTime()
    ) {
      return user;
    }

    if (
      !refreshTokenUsable(user, now) ||
      !this.options.users
        .updateGitHubCredentials
    ) {
      return user;
    }

    try {
      const refreshToken =
        decryptCredential(
          user.githubRefreshTokenCiphertext!,
          this.options
            .credentialEncryptionKey
        );

      const refreshed =
        await this.options.oauth
          .refreshAccessToken(
            refreshToken,
            now
          );

      const nextRefreshCiphertext =
        refreshed.refreshToken
          ? encryptCredential(
              refreshed.refreshToken,
              this.options
                .credentialEncryptionKey
            )
          : user
              .githubRefreshTokenCiphertext;

      const nextRefreshExpiresAt =
        refreshed.refreshToken
          ? refreshed
              .refreshTokenExpiresAt
          : user
              .githubRefreshTokenExpiresAt;

      return await this.options.users
        .updateGitHubCredentials(
          user.id,
          {
            githubAccessTokenCiphertext:
              encryptCredential(
                refreshed.accessToken,
                this.options
                  .credentialEncryptionKey
              ),
            githubAccessTokenExpiresAt:
              refreshed
                .accessTokenExpiresAt,
            githubRefreshTokenCiphertext:
              nextRefreshCiphertext,
            githubRefreshTokenExpiresAt:
              nextRefreshExpiresAt
          }
        );
    } catch {
      return user;
    }
  }

  async resolveSessionContext(
    rawToken: string,
    now = new Date()
  ): Promise<
    ResolvedAuthContext | null
  > {
    const active =
      await this.options.sessions
        .findActiveByTokenHash(
          hashSessionToken(rawToken),
          now
        );

    if (!active) {
      return null;
    }

    const user =
      await this.refreshUserCredential(
        active.user,
        now
      );

    if (
      this.options.sessions.touch &&
      now.getTime() -
        active.session.lastSeenAt
          .getTime() >=
        SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.options.sessions.touch(
        active.session.id,
        now
      );
    }

    return {
      sessionId:
        active.session.id,
      userId: user.id,
      principal: {
        provider: "GITHUB",
        providerUserId:
          user.providerUserId,
        login: user.login
      },
      githubAccessTokenCiphertext:
        user
          .githubAccessTokenCiphertext,
      githubAccessTokenExpiresAt:
        user
          .githubAccessTokenExpiresAt
    };
  }

  async resolveSession(
    rawToken: string,
    now = new Date()
  ): Promise<
    AuthenticatedPrincipal | null
  > {
    const context =
      await this.resolveSessionContext(
        rawToken,
        now
      );

    return context?.principal ?? null;
  }

  async signOut(
    rawToken: string,
    now = new Date()
  ): Promise<string> {
    await this.options.sessions
      .revokeByTokenHash(
        hashSessionToken(rawToken),
        now
      );

    return buildSessionDeletionCookie(
      this.options.secureCookies
    );
  }
}

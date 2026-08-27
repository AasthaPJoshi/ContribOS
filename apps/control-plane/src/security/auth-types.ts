export type AuthProvider = "GITHUB";

export interface AuthenticatedPrincipal {
  provider: AuthProvider;
  providerUserId: string;
  login: string;
}

export type RepositoryAccessLevel =
  | "READ"
  | "MAINTAIN"
  | "ADMIN";

export type RepositoryAccessDenialReason =
  | "UNAUTHENTICATED"
  | "REPOSITORY_NOT_AUTHORIZED"
  | "INSUFFICIENT_ACCESS";

export type RepositoryAccessDecision =
  | {
      allowed: true;
      level: RepositoryAccessLevel;
    }
  | {
      allowed: false;
      reason: RepositoryAccessDenialReason;
    };

export interface AuthenticatedSession {
  id: string;
  principal: AuthenticatedPrincipal;
  createdAt: Date;
  expiresAt: Date;
}

export interface ResolvedAuthContext {
  sessionId: string;
  userId: string;
  principal: AuthenticatedPrincipal;
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt: Date | null;
}

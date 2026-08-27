import type {
  AuthenticatedPrincipal,
  RepositoryAccessDecision,
  RepositoryAccessLevel
} from "./auth-types.js";

const ACCESS_RANK: Record<
  RepositoryAccessLevel,
  number
> = {
  READ: 1,
  MAINTAIN: 2,
  ADMIN: 3
};

export interface RepositoryAccessInput {
  principal: AuthenticatedPrincipal | null;
  grantedLevel: RepositoryAccessLevel | null;
  requiredLevel: RepositoryAccessLevel;
}

export function authorizeRepositoryAccess(
  input: RepositoryAccessInput
): RepositoryAccessDecision {
  if (!input.principal) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED"
    };
  }

  if (!input.grantedLevel) {
    return {
      allowed: false,
      reason: "REPOSITORY_NOT_AUTHORIZED"
    };
  }

  if (
    ACCESS_RANK[input.grantedLevel] <
    ACCESS_RANK[input.requiredLevel]
  ) {
    return {
      allowed: false,
      reason: "INSUFFICIENT_ACCESS"
    };
  }

  return {
    allowed: true,
    level: input.grantedLevel
  };
}

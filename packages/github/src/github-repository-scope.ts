import type { GitHubInstallationToken } from "./github-app-auth.js";

export function isRepositoryAuthorizedByToken(
  token: GitHubInstallationToken,
  repositoryId: number
): boolean {
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    return false;
  }

  if (token.repositorySelection === "all") {
    return true;
  }

  if (token.repositorySelection !== "selected") {
    return false;
  }

  if (token.repositoryIds === null) {
    return true;
  }

  return token.repositoryIds.includes(repositoryId);
}

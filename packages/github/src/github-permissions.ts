import type { GitHubInstallationToken } from "./github-app-auth.js";

export type GitHubPermissionLevel = "read" | "write" | "admin";

export interface GitHubPermissionRequirement {
  permission: string;
  level: GitHubPermissionLevel;
}

const PERMISSION_RANK: Record<GitHubPermissionLevel, number> = {
  read: 1,
  write: 2,
  admin: 3
};

export function hasGitHubPermission(
  token: GitHubInstallationToken,
  requirement: GitHubPermissionRequirement
): boolean {
  const granted = token.permissions[requirement.permission];

  if (
    granted !== "read" &&
    granted !== "write" &&
    granted !== "admin"
  ) {
    return false;
  }

  return PERMISSION_RANK[granted] >= PERMISSION_RANK[requirement.level];
}

export function getMissingGitHubPermissions(
  token: GitHubInstallationToken,
  requirements: readonly GitHubPermissionRequirement[]
): GitHubPermissionRequirement[] {
  return requirements.filter(
    (requirement) => !hasGitHubPermission(token, requirement)
  );
}

import type {
  RepositoryAccessLevel
} from "./auth-types.js";

export interface GitHubRepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

export function mapGitHubRepositoryPermission(
  permissions:
    GitHubRepositoryPermissions | undefined
): RepositoryAccessLevel | null {
  if (!permissions) {
    return null;
  }

  if (permissions.admin === true) {
    return "ADMIN";
  }

  if (
    permissions.maintain === true ||
    permissions.push === true
  ) {
    return "MAINTAIN";
  }

  if (
    permissions.triage === true ||
    permissions.pull === true
  ) {
    return "READ";
  }

  return null;
}

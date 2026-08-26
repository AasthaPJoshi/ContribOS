import { describe, expect, it } from "vitest";

import {
  getMissingGitHubPermissions,
  hasGitHubPermission
} from "../src/github-permissions.js";
import type { GitHubInstallationToken } from "../src/github-app-auth.js";

const token: GitHubInstallationToken = {
  token: "secret",
  expiresAt: new Date("2026-08-25T13:00:00.000Z"),
  permissions: {
    contents: "read",
    pull_requests: "write"
  },
  repositorySelection: "all",
  repositoryIds: null
};

describe("GitHub permission validation", () => {
  it("accepts an exact permission level", () => {
    expect(
      hasGitHubPermission(token, {
        permission: "contents",
        level: "read"
      })
    ).toBe(true);
  });

  it("accepts a stronger permission level", () => {
    expect(
      hasGitHubPermission(token, {
        permission: "pull_requests",
        level: "read"
      })
    ).toBe(true);
  });

  it("rejects a missing or weaker permission", () => {
    expect(
      hasGitHubPermission(token, {
        permission: "contents",
        level: "write"
      })
    ).toBe(false);

    expect(
      hasGitHubPermission(token, {
        permission: "checks",
        level: "read"
      })
    ).toBe(false);
  });

  it("returns all unsatisfied requirements", () => {
    expect(
      getMissingGitHubPermissions(token, [
        {
          permission: "contents",
          level: "read"
        },
        {
          permission: "checks",
          level: "read"
        }
      ])
    ).toEqual([
      {
        permission: "checks",
        level: "read"
      }
    ]);
  });
});

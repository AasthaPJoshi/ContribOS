import { describe, expect, it } from "vitest";

import { isRepositoryAuthorizedByToken } from "../src/github-repository-scope.js";
import type { GitHubInstallationToken } from "../src/github-app-auth.js";

function token(
  repositorySelection: "all" | "selected",
  repositoryIds: number[] | null
): GitHubInstallationToken {
  return {
    token: "secret",
    expiresAt: new Date("2026-08-25T13:00:00.000Z"),
    permissions: {},
    repositorySelection,
    repositoryIds
  };
}

describe("GitHub repository scope", () => {
  it("allows any valid repository for an all-repositories token", () => {
    expect(isRepositoryAuthorizedByToken(token("all", null), 101)).toBe(true);
  });

  it("allows a selected repository that is present in the token", () => {
    expect(
      isRepositoryAuthorizedByToken(token("selected", [101, 202]), 202)
    ).toBe(true);
  });

  it("rejects a repository not present in a selected token", () => {
    expect(
      isRepositoryAuthorizedByToken(token("selected", [101]), 202)
    ).toBe(false);
  });

  it("fails closed when selected repository IDs are unavailable", () => {
    expect(
      isRepositoryAuthorizedByToken(token("selected", null), 101)
    ).toBe(false);
  });
});

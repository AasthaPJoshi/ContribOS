import {
  describe,
  expect,
  it
} from "vitest";

import {
  mapGitHubRepositoryPermission
} from "../src/security/github-repository-permission.js";

describe(
  "GitHub repository permission mapping",
  () => {
    it("maps admin to ContribOS ADMIN", () => {
      expect(
        mapGitHubRepositoryPermission({
          admin: true,
          push: true,
          pull: true
        })
      ).toBe("ADMIN");
    });

    it("maps maintain or push to MAINTAIN", () => {
      expect(
        mapGitHubRepositoryPermission({
          maintain: true,
          pull: true
        })
      ).toBe("MAINTAIN");

      expect(
        mapGitHubRepositoryPermission({
          push: true,
          pull: true
        })
      ).toBe("MAINTAIN");
    });

    it("maps triage or pull to READ", () => {
      expect(
        mapGitHubRepositoryPermission({
          triage: true
        })
      ).toBe("READ");

      expect(
        mapGitHubRepositoryPermission({
          pull: true
        })
      ).toBe("READ");
    });

    it("fails closed without explicit permission", () => {
      expect(
        mapGitHubRepositoryPermission(
          {}
        )
      ).toBeNull();
    });
  }
);

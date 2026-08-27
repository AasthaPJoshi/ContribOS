import {
  describe,
  expect,
  it
} from "vitest";

import {
  authorizeRepositoryAccess
} from "../src/security/repository-access-policy.js";

const principal = {
  provider: "GITHUB",
  providerUserId: "123",
  login: "maintainer"
} as const;

describe(
  "repository access policy",
  () => {
    it("fails closed for anonymous callers", () => {
      expect(
        authorizeRepositoryAccess({
          principal: null,
          grantedLevel: null,
          requiredLevel: "READ"
        })
      ).toEqual({
        allowed: false,
        reason: "UNAUTHENTICATED"
      });
    });

    it("denies users without repository authorization", () => {
      expect(
        authorizeRepositoryAccess({
          principal,
          grantedLevel: null,
          requiredLevel: "READ"
        })
      ).toEqual({
        allowed: false,
        reason:
          "REPOSITORY_NOT_AUTHORIZED"
      });
    });

    it("enforces minimum repository access", () => {
      expect(
        authorizeRepositoryAccess({
          principal,
          grantedLevel: "READ",
          requiredLevel: "MAINTAIN"
        })
      ).toEqual({
        allowed: false,
        reason: "INSUFFICIENT_ACCESS"
      });
    });

    it("allows equal or stronger grants", () => {
      expect(
        authorizeRepositoryAccess({
          principal,
          grantedLevel: "ADMIN",
          requiredLevel: "MAINTAIN"
        })
      ).toEqual({
        allowed: true,
        level: "ADMIN"
      });
    });
  }
);

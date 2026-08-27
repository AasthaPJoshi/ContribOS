import {
  describe,
  expect,
  it
} from "vitest";

import {
  createOAuthState,
  hashOAuthState,
  oauthStatesMatch
} from "../src/security/oauth-state.js";

describe(
  "OAuth state",
  () => {
    it("creates opaque single-use state material", () => {
      const first =
        createOAuthState();
      const second =
        createOAuthState();

      expect(first).not.toBe(second);
      expect(
        hashOAuthState(first)
      ).toHaveLength(64);
      expect(
        oauthStatesMatch(
          first,
          first
        )
      ).toBe(true);
      expect(
        oauthStatesMatch(
          first,
          second
        )
      ).toBe(false);
    });
  }
);

import {
  describe,
  expect,
  it
} from "vitest";

import {
  createSessionToken,
  hashSessionToken,
  isPlausibleSessionToken
} from "../src/security/session-token.js";

describe(
  "session token primitives",
  () => {
    it("creates random opaque browser session tokens", () => {
      const first =
        createSessionToken();
      const second =
        createSessionToken();

      expect(first.token).not.toBe(
        second.token
      );
      expect(
        isPlausibleSessionToken(
          first.token
        )
      ).toBe(true);
      expect(first.tokenHash).toBe(
        hashSessionToken(first.token)
      );
    });

    it("rejects malformed tokens", () => {
      expect(
        isPlausibleSessionToken("")
      ).toBe(false);
      expect(
        isPlausibleSessionToken(
          "not a valid session token"
        )
      ).toBe(false);
    });
  }
);

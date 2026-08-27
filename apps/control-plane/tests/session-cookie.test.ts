import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildSessionCookie,
  buildSessionDeletionCookie,
  readSessionToken
} from "../src/security/session-cookie.js";
import {
  createSessionToken
} from "../src/security/session-token.js";

describe(
  "session cookie primitives",
  () => {
    it("reads a valid ContribOS session cookie", () => {
      const { token } =
        createSessionToken();

      expect(
        readSessionToken(
          `theme=dark; contribos_session=${token}; other=value`
        )
      ).toBe(token);
    });

    it("rejects malformed session cookies", () => {
      expect(
        readSessionToken(
          "contribos_session=bad token"
        )
      ).toBeNull();
    });

    it("serializes an httpOnly secure cookie", () => {
      const { token } =
        createSessionToken();

      const cookie =
        buildSessionCookie(token, {
          secure: true,
          maxAgeSeconds: 3600
        });

      expect(cookie).toContain(
        "contribos_session="
      );
      expect(cookie).toContain(
        "HttpOnly"
      );
      expect(cookie).toContain(
        "SameSite=Lax"
      );
      expect(cookie).toContain(
        "Secure"
      );
      expect(cookie).toContain(
        "Max-Age=3600"
      );
    });

    it("serializes session deletion", () => {
      expect(
        buildSessionDeletionCookie(true)
      ).toContain("Max-Age=0");
    });
  }
);

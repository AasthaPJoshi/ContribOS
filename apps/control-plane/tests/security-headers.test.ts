import {
  describe,
  expect,
  it
} from "vitest";

import {
  securityHeaders
} from "../src/security/security-headers.js";

describe(
  "security headers",
  () => {
    it("returns conservative API defaults", () => {
      expect(
        securityHeaders()
      ).toEqual({
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        "referrer-policy":
          "no-referrer",
        "x-content-type-options":
          "nosniff",
        "x-frame-options": "DENY",
        "permissions-policy":
          "camera=(), microphone=(), geolocation=()"
      });
    });
  }
);

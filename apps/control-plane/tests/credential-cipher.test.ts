import {
  describe,
  expect,
  it
} from "vitest";

import {
  decryptCredential,
  encryptCredential
} from "../src/security/credential-cipher.js";

const key =
  Buffer.alloc(32, 11)
    .toString("base64");

describe(
  "credential cipher",
  () => {
    it("round-trips a GitHub credential without storing plaintext", () => {
      const plaintext =
        "ghu_example_secret";

      const encrypted =
        encryptCredential(
          plaintext,
          key
        );

      expect(encrypted).not.toContain(
        plaintext
      );

      expect(
        decryptCredential(
          encrypted,
          key
        )
      ).toBe(plaintext);
    });

    it("rejects an invalid encryption key size", () => {
      expect(() =>
        encryptCredential(
          "secret",
          Buffer.alloc(16)
            .toString("base64")
        )
      ).toThrow(/32 bytes/);
    });
  }
);

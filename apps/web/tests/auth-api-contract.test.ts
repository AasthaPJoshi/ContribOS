import {
  describe,
  expect,
  it
} from "vitest";

import {
  contribOSApi
} from "../src/api/client.js";

describe(
  "authentication API contract",
  () => {
    it("loads the current authenticated GitHub user", async () => {
      const originalFetch =
        globalThis.fetch;

      globalThis.fetch =
        async (input) => {
          expect(
            String(input)
          ).toBe(
            "/api/auth/me"
          );

          return new Response(
            JSON.stringify({
              user: {
                provider:
                  "GITHUB",
                providerUserId:
                  "42",
                login:
                  "octocat"
              }
            }),
            {
              status: 200,
              headers: {
                "content-type":
                  "application/json"
              }
            }
          );
        };

      try {
        await expect(
          contribOSApi
            .currentUser()
        ).resolves.toEqual({
          provider:
            "GITHUB",
          providerUserId:
            "42",
          login:
            "octocat"
        });
      } finally {
        globalThis.fetch =
          originalFetch;
      }
    });

    it("uses POST for sign out", async () => {
      const originalFetch =
        globalThis.fetch;

      globalThis.fetch =
        async (
          input,
          init
        ) => {
          expect(
            String(input)
          ).toBe(
            "/auth/logout"
          );

          expect(
            init?.method
          ).toBe("POST");

          return new Response(
            null,
            {
              status: 204
            }
          );
        };

      try {
        await contribOSApi
          .signOut();
      } finally {
        globalThis.fetch =
          originalFetch;
      }
    });
  }
);

import {
  describe,
  expect,
  it
} from "vitest";

import {
  classifyRequestSecurity
} from "../src/security/request-security.js";

describe(
  "request security classification",
  () => {
    it("keeps health probes public", () => {
      expect(
        classifyRequestSecurity("/live")
      ).toEqual({
        kind: "PUBLIC"
      });

      expect(
        classifyRequestSecurity("/ready")
      ).toEqual({
        kind: "PUBLIC"
      });
    });

    it("keeps GitHub webhook authentication separate", () => {
      expect(
        classifyRequestSecurity(
          "/webhooks/github"
        )
      ).toEqual({
        kind: "GITHUB_WEBHOOK"
      });
    });

    it("marks product APIs as authenticated", () => {
      expect(
        classifyRequestSecurity(
          "/api/repositories/42"
        )
      ).toEqual({
        kind:
          "AUTHENTICATED_PRODUCT_API"
      });
    });
  }
);

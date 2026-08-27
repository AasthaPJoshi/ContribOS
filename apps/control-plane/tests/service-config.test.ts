import {
  describe,
  expect,
  it
} from "vitest";

import {
  loadServiceConfig
} from "../src/service-config.js";

describe("loadServiceConfig", () => {
  it("loads required secrets and defaults", () => {
    const config = loadServiceConfig({
      DATABASE_URL: "postgres://example",
      GITHUB_APP_ID: "123",
      GITHUB_PRIVATE_KEY: "private-key",
      GITHUB_WEBHOOK_SECRET: "secret"
    });

    expect(config.port).toBe(3000);
    expect(config.host).toBe("0.0.0.0");
  });

  it("fails closed when webhook secret is absent", () => {
    expect(() =>
      loadServiceConfig({
        DATABASE_URL: "postgres://example",
        GITHUB_APP_ID: "123",
        GITHUB_PRIVATE_KEY: "private-key"
      })
    ).toThrow(
      "GITHUB_WEBHOOK_SECRET is required."
    );
  });
});

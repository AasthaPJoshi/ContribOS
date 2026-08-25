import { describe, expect, it } from "vitest";

import { getGitHubWebhookAction } from "../src/webhook-payload.js";

describe("getGitHubWebhookAction", () => {
  it("returns a normalized action string", () => {
    expect(getGitHubWebhookAction({ action: "  opened  " })).toBe("opened");
  });

  it("returns null when action is missing", () => {
    expect(getGitHubWebhookAction({})).toBeNull();
  });

  it("returns null when action is not a string", () => {
    expect(getGitHubWebhookAction({ action: 123 })).toBeNull();
  });

  it("returns null when action is blank", () => {
    expect(getGitHubWebhookAction({ action: "   " })).toBeNull();
  });
});

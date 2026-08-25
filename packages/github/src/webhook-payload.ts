export interface GitHubActionPayload {
  action: string;
}

export function getGitHubWebhookAction(payload: unknown): string | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("action" in payload)
  ) {
    return null;
  }

  const action = payload.action;

  if (typeof action !== "string") {
    return null;
  }

  const normalized = action.trim();

  return normalized ? normalized : null;
}

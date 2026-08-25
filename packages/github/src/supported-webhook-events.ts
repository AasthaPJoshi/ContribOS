export const SUPPORTED_GITHUB_WEBHOOK_EVENTS = [
  "pull_request",
  "pull_request_review",
  "check_run",
  "check_suite",
  "workflow_run"
] as const;

export type SupportedGitHubWebhookEvent =
  (typeof SUPPORTED_GITHUB_WEBHOOK_EVENTS)[number];

export function isSupportedGitHubWebhookEvent(
  eventName: string
): eventName is SupportedGitHubWebhookEvent {
  return SUPPORTED_GITHUB_WEBHOOK_EVENTS.includes(
    eventName as SupportedGitHubWebhookEvent
  );
}

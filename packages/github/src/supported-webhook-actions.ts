const SUPPORTED_ACTIONS_BY_EVENT: Record<string, readonly string[]> = {
  pull_request: [
    "opened",
    "reopened",
    "synchronize",
    "ready_for_review",
    "converted_to_draft",
    "closed"
  ],
  pull_request_review: [
    "submitted",
    "edited",
    "dismissed"
  ],
  check_run: [
    "created",
    "rerequested",
    "completed"
  ],
  check_suite: [
    "requested",
    "rerequested",
    "completed"
  ],
  workflow_run: [
    "requested",
    "in_progress",
    "completed"
  ]
};

export function isSupportedGitHubWebhookAction(
  eventName: string,
  action: string
): boolean {
  const supportedActions = SUPPORTED_ACTIONS_BY_EVENT[eventName];

  if (!supportedActions) {
    return false;
  }

  return supportedActions.includes(action);
}
